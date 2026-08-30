import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  BlogCategory,
  BlogPost,
  HomeFeaturedAuthor,
  HomeFeaturedBlogPost,
  ReferenceItem,
  User,
} from "@/db/schema";
import { normalizeCoverImage, normalizeMediaUrl } from "@/lib/book/cover";
import type { PublicBlogPostPreview } from "@/lib/blog/service";
import {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  type FeaturedAuthor,
  type FeaturedAuthorOption,
  type FeaturedBlogPostOption,
  type HomepageCuration,
} from "@/lib/home/curation-types";

export {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  type FeaturedAuthor,
  type FeaturedAuthorOption,
  type FeaturedBlogPostOption,
  type HomepageCuration,
} from "@/lib/home/curation-types";

function uniqueIds(ids: string[]) {
  return new Set(ids).size === ids.length;
}

export async function getFeaturedAuthors(): Promise<FeaturedAuthor[]> {
  const rows = await db
    .select({
      id: ReferenceItem.id,
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
      coverImage: ReferenceItem.coverImage,
    })
    .from(HomeFeaturedAuthor)
    .innerJoin(ReferenceItem, eq(HomeFeaturedAuthor.authorId, ReferenceItem.id))
    .where(
      and(
        eq(ReferenceItem.type, "AUTHOR"),
        eq(ReferenceItem.status, "APPROVED"),
      ),
    )
    .orderBy(asc(HomeFeaturedAuthor.sortOrder), asc(HomeFeaturedAuthor.createdAt));

  return rows.map((row) => ({
    ...row,
    coverImage: normalizeCoverImage(row.coverImage),
    bookCount: 0,
    readCount: 0,
  }));
}

export async function getFeaturedHomeBlogPosts(): Promise<PublicBlogPostPreview[]> {
  const rows = await db
    .select({
      id: BlogPost.id,
      slug: BlogPost.slug,
      title: BlogPost.title,
      excerpt: BlogPost.excerpt,
      bannerImage: BlogPost.bannerImage,
      publishedAt: BlogPost.publishedAt,
      readingTime: BlogPost.readingTime,
      authorName: User.name,
      categoryName: BlogCategory.name,
      categorySlug: BlogCategory.slug,
    })
    .from(HomeFeaturedBlogPost)
    .innerJoin(BlogPost, eq(HomeFeaturedBlogPost.blogPostId, BlogPost.id))
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(eq(BlogPost.status, "PUBLISHED"), sql`${BlogPost.publishedAt} is not null`))
    .orderBy(
      asc(HomeFeaturedBlogPost.sortOrder),
      asc(HomeFeaturedBlogPost.createdAt),
    );

  return rows
    .filter((row): row is Omit<PublicBlogPostPreview, "bannerImage"> & { bannerImage: string; publishedAt: Date } =>
      Boolean(row.publishedAt),
    )
    .map((row) => ({ ...row, bannerImage: normalizeMediaUrl(row.bannerImage) ?? "" }));
}

export async function getHomepageCuration(): Promise<HomepageCuration> {
  const [authors, posts] = await Promise.all([
    db
      .select({
        id: ReferenceItem.id,
        name: ReferenceItem.name,
        slug: ReferenceItem.slug,
        coverImage: ReferenceItem.coverImage,
      })
      .from(HomeFeaturedAuthor)
      .innerJoin(ReferenceItem, eq(HomeFeaturedAuthor.authorId, ReferenceItem.id))
      .orderBy(asc(HomeFeaturedAuthor.sortOrder), asc(HomeFeaturedAuthor.createdAt)),
    db
      .select({
        id: BlogPost.id,
        title: BlogPost.title,
        bannerImage: BlogPost.bannerImage,
        categoryName: BlogCategory.name,
      })
      .from(HomeFeaturedBlogPost)
      .innerJoin(BlogPost, eq(HomeFeaturedBlogPost.blogPostId, BlogPost.id))
      .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
      .orderBy(
        asc(HomeFeaturedBlogPost.sortOrder),
        asc(HomeFeaturedBlogPost.createdAt),
      ),
  ]);

  return {
    authors: authors.map((author) => ({
      ...author,
      coverImage: normalizeCoverImage(author.coverImage),
    })),
    posts: posts.map((post) => ({
      ...post,
      bannerImage: normalizeMediaUrl(post.bannerImage) ?? "",
    })),
  };
}

export async function searchFeaturedAuthors(query: string): Promise<FeaturedAuthorOption[]> {
  const term = query.trim();
  if (!term) return [];

  const rows = await db
    .select({
      id: ReferenceItem.id,
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
      coverImage: ReferenceItem.coverImage,
    })
    .from(ReferenceItem)
    .where(
      and(
        eq(ReferenceItem.type, "AUTHOR"),
        eq(ReferenceItem.status, "APPROVED"),
        ilike(ReferenceItem.name, `%${term}%`),
      ),
    )
    .orderBy(asc(ReferenceItem.name))
    .limit(12);

  return rows.map((row) => ({ ...row, coverImage: normalizeCoverImage(row.coverImage) }));
}

export async function searchFeaturedBlogPosts(
  query: string,
): Promise<FeaturedBlogPostOption[]> {
  const term = query.trim();
  if (!term) return [];

  const rows = await db
    .select({
      id: BlogPost.id,
      title: BlogPost.title,
      bannerImage: BlogPost.bannerImage,
      categoryName: BlogCategory.name,
    })
    .from(BlogPost)
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(eq(BlogPost.status, "PUBLISHED"), ilike(BlogPost.title, `%${term}%`)))
    .orderBy(asc(BlogPost.title))
    .limit(12);

  return rows.map((row) => ({ ...row, bannerImage: normalizeMediaUrl(row.bannerImage) ?? "" }));
}

export async function saveHomepageCuration(input: {
  authorIds: string[];
  postIds: string[];
}): Promise<void> {
  const { authorIds, postIds } = input;
  if (
    authorIds.length > FEATURED_AUTHOR_LIMIT ||
    postIds.length > FEATURED_BLOG_POST_LIMIT ||
    !uniqueIds(authorIds) ||
    !uniqueIds(postIds)
  ) {
    throw new Error("HOMEPAGE_CURATION_INVALID");
  }

  const [authors, posts] = await Promise.all([
    authorIds.length
      ? db
          .select({ id: ReferenceItem.id })
          .from(ReferenceItem)
          .where(
            and(
              inArray(ReferenceItem.id, authorIds),
              eq(ReferenceItem.type, "AUTHOR"),
              eq(ReferenceItem.status, "APPROVED"),
            ),
          )
      : Promise.resolve([]),
    postIds.length
      ? db
          .select({ id: BlogPost.id })
          .from(BlogPost)
          .where(
            and(
              inArray(BlogPost.id, postIds),
              eq(BlogPost.status, "PUBLISHED"),
              sql`${BlogPost.publishedAt} is not null`,
            ),
          )
      : Promise.resolve([]),
  ]);

  if (authors.length !== authorIds.length || posts.length !== postIds.length) {
    throw new Error("HOMEPAGE_CURATION_RECORD_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await Promise.all([
      tx.delete(HomeFeaturedAuthor),
      tx.delete(HomeFeaturedBlogPost),
    ]);

    if (authorIds.length) {
      await tx.insert(HomeFeaturedAuthor).values(
        authorIds.map((authorId, sortOrder) => ({ authorId, sortOrder })),
      );
    }
    if (postIds.length) {
      await tx.insert(HomeFeaturedBlogPost).values(
        postIds.map((blogPostId, sortOrder) => ({ blogPostId, sortOrder })),
      );
    }
  });
}
