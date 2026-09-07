import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { BlogCategory, BlogPost, BlogPostAuthor, BlogPostBook, BlogPostGenre, CatalogBook, ReferenceItem, User } from "@/db/schema";
import { slugify } from "@/lib/book/slug";
import { decodeBlogCategorySlug, normalizeBlogCategorySlug } from "@/lib/blog/category-slug";
import { normalizeMediaUrl } from "@/lib/book/cover";
import { sanitizeRichTextHtml } from "@/lib/content/rich-text";
import type { BlogArchiveSort } from "@/components/blog/blog-archive";
import { extractBlogBookEmbedIds, resolveBlogBookEmbeds, type BlogBookEmbed } from "@/lib/blog/book-embed";
import type {
  BlogCategoryInput,
  BlogPostInput,
} from "@/lib/validations/blog";

export const BLOG_PAGE_SIZE = 9;
export const ADMIN_BLOG_PAGE_SIZE = 12;

export interface AdminBlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  bannerImage: string;
  status: "DRAFT" | "PUBLISHED";
  authorName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  readingTime: number | null;
}

export interface AdminBlogPostDetail extends AdminBlogPostRow {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  relatedBookIds: string[];
  relatedAuthorIds: string[];
  relatedGenreIds: string[];
}

export interface PublicBlogPostPreview {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bannerImage: string;
  publishedAt: Date;
  readingTime: number | null;
  authorName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
}

export interface PublicBlogPost extends PublicBlogPostPreview {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  updatedAt: Date;
}

export type MagazineRelatedEntities = {
  books: BlogBookEmbed[];
  authors: { id: string; name: string; slug: string; coverImage: string | null }[];
  genres: { id: string; name: string; slug: string }[];
};

export interface AdminBlogCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogCategoryOption {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadingTime(html: string) {
  const plain = stripHtml(html);
  if (!plain) return 1;
  const words = plain.split(/\s+/).filter(Boolean).length;
  // 300 words/minute gives a more realistic estimate for Persian magazine
  // articles; 200 made long-form posts look noticeably slower than they are.
  return Math.max(1, Math.round(words / 300));
}

function normalizeBlogBanner<T extends { bannerImage: string }>(post: T): T {
  return {
    ...post,
    // Public DTOs always expose the original source URL, never an optimizer
    // URL or a bare object key that public Image components cannot resolve.
    bannerImage: normalizeMediaUrl(post.bannerImage) ?? "",
  };
}

async function generateUniqueBlogSlug(title: string, excludeId?: string) {
  const base = slugify(title) || "blog-post";
  const rows = await db
    .select({ slug: BlogPost.slug, id: BlogPost.id })
    .from(BlogPost)
    .where(sql`${BlogPost.slug} = ${base} or ${BlogPost.slug} like ${`${base}-%`}`);

  const taken = new Set(
    rows
      .filter((row) => row.id !== excludeId)
      .map((row) => row.slug)
      .filter(Boolean),
  );

  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function generateUniqueCategorySlug(name: string, excludeId?: string) {
  const base = normalizeBlogCategorySlug(name) || "category";
  const rows = await db
    .select({ slug: BlogCategory.slug, id: BlogCategory.id })
    .from(BlogCategory)
    .where(
      sql`${BlogCategory.slug} = ${base} or ${BlogCategory.slug} like ${`${base}-%`}`,
    );

  const taken = new Set(
    rows
      .filter((row) => row.id !== excludeId)
      .map((row) => row.slug)
      .filter(Boolean),
  );

  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** آیا دسته‌بندیِ بلاگ با این شناسه وجود دارد؟ (برای اعتبارسنجی ورودی فرم نوشته). */
export async function blogCategoryExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: BlogCategory.id })
    .from(BlogCategory)
    .where(eq(BlogCategory.id, id))
    .limit(1);
  return !!row;
}

function normalizeInput(input: BlogPostInput) {
  const sanitizedContent = sanitizeRichTextHtml(input.content);
  const publishedAt =
    input.status === "PUBLISHED"
      ? input.publishedAt
        ? new Date(input.publishedAt)
        : new Date()
      : null;

  return {
    title: input.title.trim(),
    categoryId: input.categoryId,
    excerpt: input.excerpt.trim(),
    content: sanitizedContent,
    bannerImage: normalizeMediaUrl(input.bannerImage) ?? input.bannerImage.trim(),
    status: input.status,
    publishedAt,
    readingTime: estimateReadingTime(sanitizedContent),
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
    canonicalUrl: input.canonicalUrl?.trim() || null,
    ogImage: (normalizeMediaUrl(input.ogImage) ?? input.ogImage?.trim()) || null,
  };
}

async function validateRelationshipIds(input: Pick<BlogPostInput, "relatedBookIds" | "relatedAuthorIds" | "relatedGenreIds">) {
  const [books, authors, genres] = await Promise.all([
    input.relatedBookIds.length ? db.select({ id: CatalogBook.id }).from(CatalogBook).where(and(inArray(CatalogBook.id, input.relatedBookIds), eq(CatalogBook.status, "APPROVED"))) : Promise.resolve([]),
    input.relatedAuthorIds.length ? db.select({ id: ReferenceItem.id }).from(ReferenceItem).where(and(inArray(ReferenceItem.id, input.relatedAuthorIds), eq(ReferenceItem.type, "AUTHOR"), eq(ReferenceItem.status, "APPROVED"))) : Promise.resolve([]),
    input.relatedGenreIds.length ? db.select({ id: ReferenceItem.id }).from(ReferenceItem).where(and(inArray(ReferenceItem.id, input.relatedGenreIds), eq(ReferenceItem.type, "GENRE"), eq(ReferenceItem.status, "APPROVED"))) : Promise.resolve([]),
  ]);
  if (books.length !== input.relatedBookIds.length || authors.length !== input.relatedAuthorIds.length || genres.length !== input.relatedGenreIds.length) throw new Error("BLOG_RELATION_NOT_FOUND");
}

async function replaceBlogPostRelations(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], postId: string, input: Pick<BlogPostInput, "relatedBookIds" | "relatedAuthorIds" | "relatedGenreIds">) {
  await Promise.all([tx.delete(BlogPostBook).where(eq(BlogPostBook.postId, postId)), tx.delete(BlogPostAuthor).where(eq(BlogPostAuthor.postId, postId)), tx.delete(BlogPostGenre).where(eq(BlogPostGenre.postId, postId))]);
  if (input.relatedBookIds.length) await tx.insert(BlogPostBook).values(input.relatedBookIds.map((bookId) => ({ postId, bookId })));
  if (input.relatedAuthorIds.length) await tx.insert(BlogPostAuthor).values(input.relatedAuthorIds.map((authorId) => ({ postId, authorId })));
  if (input.relatedGenreIds.length) await tx.insert(BlogPostGenre).values(input.relatedGenreIds.map((genreId) => ({ postId, genreId })));
}

export async function listAdminBlogPosts({
  q,
  status,
  limit = ADMIN_BLOG_PAGE_SIZE,
  offset = 0,
}: {
  q?: string;
  status?: "DRAFT" | "PUBLISHED";
  limit?: number;
  offset?: number;
}): Promise<{ posts: AdminBlogPostRow[]; total: number }> {
  const conditions = [];
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(
      or(
        ilike(BlogPost.title, term),
        ilike(BlogPost.excerpt, term),
        ilike(BlogPost.slug, term),
      ),
    );
  }
  if (status) conditions.push(eq(BlogPost.status, status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [posts, totalRows] = await Promise.all([
    db
      .select({
        id: BlogPost.id,
        title: BlogPost.title,
        slug: BlogPost.slug,
        excerpt: BlogPost.excerpt,
        bannerImage: BlogPost.bannerImage,
        status: BlogPost.status,
        authorName: User.name,
        categoryId: BlogPost.categoryId,
        categoryName: BlogCategory.name,
        publishedAt: BlogPost.publishedAt,
        updatedAt: BlogPost.updatedAt,
        createdAt: BlogPost.createdAt,
        readingTime: BlogPost.readingTime,
      })
      .from(BlogPost)
      .leftJoin(User, eq(BlogPost.createdById, User.id))
      .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
      .where(where)
      .orderBy(desc(BlogPost.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(BlogPost).where(where),
  ]);

  return { posts: posts.map(normalizeBlogBanner), total: totalRows[0]?.total ?? 0 };
}

export async function getAdminBlogPostById(id: string): Promise<AdminBlogPostDetail | null> {
  const [post] = await db
    .select({
      id: BlogPost.id,
      title: BlogPost.title,
      slug: BlogPost.slug,
      excerpt: BlogPost.excerpt,
      content: BlogPost.content,
      bannerImage: BlogPost.bannerImage,
      status: BlogPost.status,
      authorName: User.name,
      categoryId: BlogPost.categoryId,
      categoryName: BlogCategory.name,
      publishedAt: BlogPost.publishedAt,
      updatedAt: BlogPost.updatedAt,
      createdAt: BlogPost.createdAt,
      readingTime: BlogPost.readingTime,
      seoTitle: BlogPost.seoTitle,
      seoDescription: BlogPost.seoDescription,
      canonicalUrl: BlogPost.canonicalUrl,
      ogImage: BlogPost.ogImage,
    })
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(eq(BlogPost.id, id))
    .limit(1);

  if (!post) return null;
  const [books, authors, genres] = await Promise.all([
    db.select({ id: BlogPostBook.bookId }).from(BlogPostBook).where(eq(BlogPostBook.postId, id)),
    db.select({ id: BlogPostAuthor.authorId }).from(BlogPostAuthor).where(eq(BlogPostAuthor.postId, id)),
    db.select({ id: BlogPostGenre.genreId }).from(BlogPostGenre).where(eq(BlogPostGenre.postId, id)),
  ]);
  return { ...normalizeBlogBanner(post), relatedBookIds: books.map((row) => row.id), relatedAuthorIds: authors.map((row) => row.id), relatedGenreIds: genres.map((row) => row.id) };
}

export async function createBlogPost(input: BlogPostInput, adminId: string) {
  const normalized = normalizeInput(input);
  await validateRelationshipIds(input);
  const categoryOk = await blogCategoryExists(normalized.categoryId);
  if (!categoryOk) {
    throw new Error("BLOG_CATEGORY_NOT_FOUND");
  }
  // اسلاگ به‌صورت خودکار از عنوان ساخته می‌شود (یکتا).
  const slug = await generateUniqueBlogSlug(normalized.title);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(BlogPost).values({
      title: normalized.title,
      slug,
      categoryId: normalized.categoryId,
      excerpt: normalized.excerpt,
      content: normalized.content,
      bannerImage: normalized.bannerImage,
      status: normalized.status,
      createdById: adminId,
      publishedAt: normalized.publishedAt,
      readingTime: normalized.readingTime,
      seoTitle: normalized.seoTitle,
      seoDescription: normalized.seoDescription,
      canonicalUrl: normalized.canonicalUrl,
      ogImage: normalized.ogImage,
    }).returning({ id: BlogPost.id, slug: BlogPost.slug });
    await replaceBlogPostRelations(tx, row.id, input);
    return row;
  });

  return created;
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  const normalized = normalizeInput(input);
  await validateRelationshipIds(input);
  const categoryOk = await blogCategoryExists(normalized.categoryId);
  if (!categoryOk) {
    throw new Error("BLOG_CATEGORY_NOT_FOUND");
  }

  // اسلاگ پس از ساخت پایدار می‌ماند؛ در ویرایش تغییر نمی‌کند تا URL عمومی نشکند.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(BlogPost).set({
      title: normalized.title,
      categoryId: normalized.categoryId,
      excerpt: normalized.excerpt,
      content: normalized.content,
      bannerImage: normalized.bannerImage,
      status: normalized.status,
      publishedAt: normalized.publishedAt,
      readingTime: normalized.readingTime,
      seoTitle: normalized.seoTitle,
      seoDescription: normalized.seoDescription,
      canonicalUrl: normalized.canonicalUrl,
      ogImage: normalized.ogImage,
      updatedAt: new Date(),
    }).where(eq(BlogPost.id, id)).returning({ id: BlogPost.id, slug: BlogPost.slug });
    if (!row) throw new Error("BLOG_POST_NOT_FOUND");
    await replaceBlogPostRelations(tx, id, input);
    return row;
  });

  return updated;
}

export async function deleteBlogPost(id: string) {
  await db.delete(BlogPost).where(eq(BlogPost.id, id));
}

export async function listPublicBlogPosts({
  q,
  categorySlug,
  sort = "newest",
  page,
  pageSize = BLOG_PAGE_SIZE,
}: {
  q?: string;
  categorySlug?: string;
  sort?: BlogArchiveSort;
  page: number;
  pageSize?: number;
}): Promise<{
  posts: PublicBlogPostPreview[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const conditions = [eq(BlogPost.status, "PUBLISHED")];
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(
      or(
        ilike(BlogPost.title, term),
        ilike(BlogPost.excerpt, term),
        ilike(BlogPost.content, term),
        ilike(User.name, term),
        ilike(BlogCategory.name, term),
        sql`exists (select 1 from "BlogPostBook" article_book inner join "CatalogBook" book on book.id = article_book.book_id where article_book.post_id = ${BlogPost.id} and (book.title ilike ${term} or book.author ilike ${term}))`,
      )!,
    );
  }
  if (categorySlug?.trim()) {
    const category = await getPublicBlogCategoryBySlug(categorySlug);
    if (!category) {
      return { posts: [], total: 0, page: 1, pageCount: 1 };
    }
    conditions.push(eq(BlogCategory.slug, category.slug));
  }

  const where = and(...conditions);
  const totalRows = await db
    .select({ total: count() })
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(where);
  const total = totalRows[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const offset = (safePage - 1) * pageSize;

  const posts = await db
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
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(where)
    .orderBy(
      ...(sort === "oldest"
        ? [asc(BlogPost.publishedAt), asc(BlogPost.createdAt)]
        : sort === "shortest"
          ? [asc(BlogPost.readingTime), desc(BlogPost.publishedAt)]
          : [desc(BlogPost.publishedAt), desc(BlogPost.createdAt)]),
    )
    .limit(pageSize)
    .offset(offset);

  return {
    posts: posts
      .filter((post): post is PublicBlogPostPreview => Boolean(post.publishedAt))
      .map(normalizeBlogBanner),
    total,
    page: safePage,
    pageCount,
  };
}

export async function hasPublishedBlogPosts(): Promise<boolean> {
  const [row] = await db
    .select({ total: count() })
    .from(BlogPost)
    .where(and(eq(BlogPost.status, "PUBLISHED"), isNotNull(BlogPost.publishedAt)));

  return (row?.total ?? 0) > 0;
}

export async function getLatestPublishedBlogPosts(
  limit = 3,
): Promise<PublicBlogPostPreview[]> {
  const posts = await db
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
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(eq(BlogPost.status, "PUBLISHED"), sql`${BlogPost.publishedAt} is not null`))
    .orderBy(desc(BlogPost.publishedAt), desc(BlogPost.createdAt))
    .limit(limit);

  return posts
    .filter((post): post is PublicBlogPostPreview => Boolean(post.publishedAt))
    .map(normalizeBlogBanner);
}

export async function getPublicBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const [post] = await db
    .select({
      id: BlogPost.id,
      slug: BlogPost.slug,
      title: BlogPost.title,
      excerpt: BlogPost.excerpt,
      content: BlogPost.content,
      bannerImage: BlogPost.bannerImage,
      publishedAt: BlogPost.publishedAt,
      readingTime: BlogPost.readingTime,
      authorName: User.name,
      categoryName: BlogCategory.name,
      categorySlug: BlogCategory.slug,
      seoTitle: BlogPost.seoTitle,
      seoDescription: BlogPost.seoDescription,
      canonicalUrl: BlogPost.canonicalUrl,
      ogImage: BlogPost.ogImage,
      updatedAt: BlogPost.updatedAt,
    })
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(eq(BlogPost.slug, slug), eq(BlogPost.status, "PUBLISHED")))
    .limit(1);

  if (!post || !post.publishedAt) return null;

  return normalizeBlogBanner({
    ...post,
    publishedAt: post.publishedAt,
  });
}

/** Deterministic Phase 1 related-content query; never returns the current post. */
export async function getRelatedPublishedBlogPosts(post: Pick<PublicBlogPost, "id" | "categorySlug">, limit = 3) {
  if (!post.categorySlug) return [];
  const rows = await db
    .select({
      id: BlogPost.id, slug: BlogPost.slug, title: BlogPost.title, excerpt: BlogPost.excerpt,
      bannerImage: BlogPost.bannerImage, publishedAt: BlogPost.publishedAt, readingTime: BlogPost.readingTime,
      authorName: User.name, categoryName: BlogCategory.name, categorySlug: BlogCategory.slug,
    })
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(eq(BlogPost.status, "PUBLISHED"), eq(BlogCategory.slug, post.categorySlug), sql`${BlogPost.id} <> ${post.id}`, sql`${BlogPost.publishedAt} is not null`))
    .orderBy(desc(BlogPost.publishedAt), desc(BlogPost.createdAt))
    .limit(limit);
  return rows.filter((row): row is PublicBlogPostPreview => Boolean(row.publishedAt)).map(normalizeBlogBanner);
}

export async function getMagazineRelatedEntities(post: Pick<PublicBlogPost, "id" | "content">): Promise<MagazineRelatedEntities> {
  const [manualBooks, authors, genres] = await Promise.all([
    db.select({ id: BlogPostBook.bookId }).from(BlogPostBook).where(eq(BlogPostBook.postId, post.id)),
    db.select({ id: ReferenceItem.id, name: ReferenceItem.name, slug: ReferenceItem.slug, coverImage: ReferenceItem.coverImage }).from(BlogPostAuthor).innerJoin(ReferenceItem, eq(BlogPostAuthor.authorId, ReferenceItem.id)).where(and(eq(BlogPostAuthor.postId, post.id), eq(ReferenceItem.type, "AUTHOR"), eq(ReferenceItem.status, "APPROVED"), isNotNull(ReferenceItem.slug))),
    db.select({ id: ReferenceItem.id, name: ReferenceItem.name, slug: ReferenceItem.slug }).from(BlogPostGenre).innerJoin(ReferenceItem, eq(BlogPostGenre.genreId, ReferenceItem.id)).where(and(eq(BlogPostGenre.postId, post.id), eq(ReferenceItem.type, "GENRE"), eq(ReferenceItem.status, "APPROVED"), isNotNull(ReferenceItem.slug))),
  ]);
  const booksById = await resolveBlogBookEmbeds([...manualBooks.map((row) => row.id), ...extractBlogBookEmbedIds(post.content)]);
  return { books: [...booksById.values()], authors: authors.map((row) => ({ ...row, slug: row.slug! })), genres: genres.map((row) => ({ ...row, slug: row.slug! })) };
}

async function listPublishedMagazineArticlesByRelation(where: ReturnType<typeof and> | undefined, limit: number) {
  const rows = await db.select({ id: BlogPost.id, slug: BlogPost.slug, title: BlogPost.title, excerpt: BlogPost.excerpt, bannerImage: BlogPost.bannerImage, publishedAt: BlogPost.publishedAt, readingTime: BlogPost.readingTime, authorName: User.name, categoryName: BlogCategory.name, categorySlug: BlogCategory.slug }).from(BlogPost).leftJoin(User, eq(BlogPost.createdById, User.id)).leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id)).where(and(eq(BlogPost.status, "PUBLISHED"), isNotNull(BlogPost.publishedAt), where)).orderBy(desc(BlogPost.publishedAt)).limit(limit);
  return rows.filter((row): row is PublicBlogPostPreview => Boolean(row.publishedAt)).map(normalizeBlogBanner);
}

export function getMagazineArticlesForBook(bookId: string, limit = 4) {
  // Embed references are computed from canonical article content, so legacy embeds work immediately.
  return listPublishedMagazineArticlesByRelation(or(sql`exists (select 1 from "BlogPostBook" edge where edge.post_id = ${BlogPost.id} and edge.book_id = ${bookId})`, sql`${BlogPost.content} ilike ${`%data-blog-book-id="${bookId}"%`}`), limit);
}

export function getMagazineArticlesForAuthor(authorId: string, limit = 4) {
  return listPublishedMagazineArticlesByRelation(sql`exists (select 1 from "BlogPostAuthor" edge where edge.post_id = ${BlogPost.id} and edge.author_id = ${authorId})`, limit);
}

export function getMagazineArticlesForGenre(genreId: string, limit = 4) {
  return listPublishedMagazineArticlesByRelation(sql`exists (select 1 from "BlogPostGenre" edge where edge.post_id = ${BlogPost.id} and edge.genre_id = ${genreId})`, limit);
}

// ---------------- دسته‌بندی‌های بلاگ ----------------
export async function listBlogCategories(): Promise<AdminBlogCategoryRow[]> {
  return db
    .select({
      id: BlogCategory.id,
      name: BlogCategory.name,
      slug: BlogCategory.slug,
      description: BlogCategory.description,
      postCount: count(BlogPost.id),
      createdAt: BlogCategory.createdAt,
      updatedAt: BlogCategory.updatedAt,
    })
    .from(BlogCategory)
    .leftJoin(BlogPost, eq(BlogPost.categoryId, BlogCategory.id))
    .groupBy(BlogCategory.id)
    .orderBy(asc(BlogCategory.name));
}

/** فهرست سبک دسته‌بندی‌ها برای انتخاب در فرم نوشته و فیلتر آرشیو عمومی. */
export async function listBlogCategoryOptions(): Promise<BlogCategoryOption[]> {
  return db
    .select({
      id: BlogCategory.id,
      name: BlogCategory.name,
      slug: BlogCategory.slug,
      description: BlogCategory.description,
    })
    .from(BlogCategory)
    .orderBy(asc(BlogCategory.name));
}

export async function getBlogCategoryById(
  id: string,
): Promise<AdminBlogCategoryRow | null> {
  const [row] = await db
    .select({
      id: BlogCategory.id,
      name: BlogCategory.name,
      slug: BlogCategory.slug,
      description: BlogCategory.description,
      postCount: count(BlogPost.id),
      createdAt: BlogCategory.createdAt,
      updatedAt: BlogCategory.updatedAt,
    })
    .from(BlogCategory)
    .leftJoin(BlogPost, eq(BlogPost.categoryId, BlogCategory.id))
    .where(eq(BlogCategory.id, id))
    .groupBy(BlogCategory.id)
    .limit(1);
  return row ?? null;
}

export async function getPublicBlogCategoryBySlug(
  slug: string,
): Promise<BlogCategoryOption | null> {
  const requestedSlug = decodeBlogCategorySlug(slug).trim();
  const normalizedSlug = normalizeBlogCategorySlug(requestedSlug);
  if (!requestedSlug || !normalizedSlug) return null;

  const rows = await db
    .select({
      id: BlogCategory.id,
      name: BlogCategory.name,
      slug: BlogCategory.slug,
      description: BlogCategory.description,
    })
    .from(BlogCategory);

  // Keep legacy URLs working while allowing equivalent Persian/Arabic input.
  // The category table is intentionally small, and this avoids a database-
  // specific Unicode-normalization expression while retaining exact canonical
  // slugs for all subsequent post queries and generated links.
  return (
    rows.find((row) => row.slug === requestedSlug) ??
    rows.find((row) => row.slug === normalizedSlug) ??
    rows.find(
      (row) => normalizeBlogCategorySlug(row.slug) === normalizedSlug,
    ) ??
    null
  );
}

export async function createBlogCategory(input: BlogCategoryInput) {
  const slug = await generateUniqueCategorySlug(input.name);
  const [created] = await db
    .insert(BlogCategory)
    .values({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
    })
    .returning({ id: BlogCategory.id, slug: BlogCategory.slug });
  return created;
}

export async function updateBlogCategory(id: string, input: BlogCategoryInput) {
  // اسلاگ دسته‌بندی پس از ساخت پایدار می‌ماند.
  await db
    .update(BlogCategory)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(BlogCategory.id, id));
}

/** حذف امن: اگر نوشته‌ای به این دسته متصل باشد، حذف مسدود می‌شود. */
export async function deleteBlogCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(BlogPost)
    .where(eq(BlogPost.categoryId, id));

  if (total > 0) {
    return {
      ok: false,
      reason: `این دسته‌بندی به ${total.toLocaleString("fa-IR")} نوشته متصل است. ابتدا نوشته‌ها را به دسته‌ی دیگری منتقل کن.`,
    };
  }

  await db.delete(BlogCategory).where(eq(BlogCategory.id, id));
  return { ok: true };
}
