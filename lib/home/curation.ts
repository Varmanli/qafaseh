import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  BlogCategory,
  BlogPost,
  HomeFeaturedAuthor,
  HomeFeaturedBlogPost,
  HomeFeaturedReadingList,
  ReadingList,
  ReferenceItem,
  User,
} from "@/db/schema";
import { normalizeCoverImage, normalizeMediaUrl } from "@/lib/book/cover";
import type { PublicBlogPostPreview } from "@/lib/blog/service";
import {
  getReadingListsOverview,
  type ReadingListPreview,
} from "@/lib/book/reading-lists-service";
import {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  FEATURED_READING_LIST_LIMIT,
  type FeaturedAuthor,
  type FeaturedAuthorOption,
  type FeaturedBlogPostOption,
  type FeaturedReadingListOption,
  type HomepageCuration,
} from "@/lib/home/curation-types";

export {
  FEATURED_AUTHOR_LIMIT,
  FEATURED_BLOG_POST_LIMIT,
  FEATURED_READING_LIST_LIMIT,
  type FeaturedAuthor,
  type FeaturedAuthorOption,
  type FeaturedBlogPostOption,
  type FeaturedReadingListOption,
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

export async function getFeaturedHomeReadingLists(): Promise<ReadingListPreview[]> {
  const selected = await db
    .select({ id: ReadingList.id })
    .from(HomeFeaturedReadingList)
    .innerJoin(ReadingList, eq(HomeFeaturedReadingList.readingListId, ReadingList.id))
    .where(and(eq(ReadingList.status, "PUBLISHED"), eq(ReadingList.mode, "ORDERED")))
    .orderBy(
      asc(HomeFeaturedReadingList.sortOrder),
      asc(HomeFeaturedReadingList.createdAt),
    );
  if (!selected.length) return [];

  const byId = new Map((await getReadingListsOverview()).map((list) => [list.id, list]));
  return selected
    .map(({ id }) => byId.get(id))
    .filter((list): list is ReadingListPreview => Boolean(list));
}

export async function getHomepageCuration(): Promise<HomepageCuration> {
  const [authors, posts, readingLists] = await Promise.all([
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
    db
      .select({
        id: ReadingList.id,
        title: ReadingList.title,
        slug: ReadingList.slug,
        category: ReadingList.category,
        mode: ReadingList.mode,
      })
      .from(HomeFeaturedReadingList)
      .innerJoin(ReadingList, eq(HomeFeaturedReadingList.readingListId, ReadingList.id))
      .where(eq(ReadingList.status, "PUBLISHED"))
      .orderBy(
        asc(HomeFeaturedReadingList.sortOrder),
        asc(HomeFeaturedReadingList.createdAt),
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
    readingLists,
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

export async function searchFeaturedReadingLists(
  query: string,
): Promise<FeaturedReadingListOption[]> {
  const term = query.trim();
  if (!term) return [];

  return db
    .select({
      id: ReadingList.id,
      title: ReadingList.title,
      slug: ReadingList.slug,
      category: ReadingList.category,
      mode: ReadingList.mode,
    })
    .from(ReadingList)
    .where(and(eq(ReadingList.status, "PUBLISHED"), eq(ReadingList.mode, "ORDERED"), ilike(ReadingList.title, `%${term}%`)))
    .orderBy(asc(ReadingList.title))
    .limit(12);
}

export async function saveHomepageCuration(input: {
  authorIds: string[];
  postIds: string[];
  readingListIds: string[];
}): Promise<void> {
  const { authorIds, postIds, readingListIds } = input;
  if (
    authorIds.length > FEATURED_AUTHOR_LIMIT ||
    postIds.length > FEATURED_BLOG_POST_LIMIT ||
    readingListIds.length > FEATURED_READING_LIST_LIMIT ||
    !uniqueIds(authorIds) ||
    !uniqueIds(postIds) ||
    !uniqueIds(readingListIds)
  ) {
    throw new Error("HOMEPAGE_CURATION_INVALID");
  }

  const [authors, posts, readingLists] = await Promise.all([
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
    readingListIds.length
      ? db
          .select({ id: ReadingList.id })
          .from(ReadingList)
          .where(
            and(
              inArray(ReadingList.id, readingListIds),
              eq(ReadingList.status, "PUBLISHED"),
              eq(ReadingList.mode, "ORDERED"),
            ),
          )
      : Promise.resolve([]),
  ]);

  if (
    authors.length !== authorIds.length ||
    posts.length !== postIds.length ||
    readingLists.length !== readingListIds.length
  ) {
    throw new Error("HOMEPAGE_CURATION_RECORD_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await Promise.all([
      tx.delete(HomeFeaturedAuthor),
      tx.delete(HomeFeaturedBlogPost),
      tx.delete(HomeFeaturedReadingList),
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
    if (readingListIds.length) {
      await tx.insert(HomeFeaturedReadingList).values(
        readingListIds.map((readingListId, sortOrder) => ({ readingListId, sortOrder })),
      );
    }
  });
}
