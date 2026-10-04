import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { Book, CatalogBook, PublishedBookNote, PublishedBookNoteLike, Quote, QuoteLike, User } from "@/db/schema";
import { noteContentSchema } from "@/lib/validations/notes";
import { richTextToPlainText, sanitizeRichTextHtml } from "@/lib/content/rich-text";
import { isOwnedQuoteImageKey, normalizeQuoteImageKey, normalizeQuoteText } from "@/lib/quotes/image";
import { normalizeQuoteBackground } from "@/lib/quotes/backgrounds";
import { deleteImageUpload } from "@/lib/server/upload-storage";
import { recordPublishedActivity } from "@/lib/social/activity";

export const ADMIN_CONTENT_PAGE_SIZE = 15;

export type AdminContentKind = "quotes" | "notes";
export interface AdminContentQuery {
  q?: string; userId?: string; bookId?: string; contentType?: string;
  dateFrom?: string; dateTo?: string; sort?: string; page: number;
}

function dateValue(value?: string, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listAdminQuotes(query: AdminContentQuery) {
  const filters: SQL[] = [];
  const q = query.q?.trim();
  if (q) {
    const search = `%${q}%`;
    const pageNumber = Number(q);
    filters.push(or(
      ilike(Quote.content, search), ilike(Book.title, search), ilike(User.name, search),
      ilike(User.email, search), ilike(User.username, search),
      Number.isInteger(pageNumber) ? eq(Quote.page, pageNumber) : undefined,
    )!);
  }
  if (query.userId) filters.push(eq(Quote.userId, query.userId));
  if (query.bookId) filters.push(eq(Book.id, query.bookId));
  if (query.contentType === "text") filters.push(sql`${Quote.imageKey} is null and length(trim(${Quote.content})) > 0`);
  if (query.contentType === "image") filters.push(sql`${Quote.imageKey} is not null and length(trim(${Quote.content})) = 0`);
  if (query.contentType === "both") filters.push(sql`${Quote.imageKey} is not null and length(trim(${Quote.content})) > 0`);
  if (query.contentType === "has-image") filters.push(sql`${Quote.imageKey} is not null`);
  const from = dateValue(query.dateFrom); const to = dateValue(query.dateTo, true);
  if (from) filters.push(gte(Quote.createdAt, from)); if (to) filters.push(lte(Quote.createdAt, to));
  const where = filters.length ? and(...filters) : undefined;
  const likeCount = sql<number>`count(${QuoteLike.id})::int`;
  const order = query.sort === "oldest" ? asc(Quote.createdAt)
    : query.sort === "updated" ? desc(Quote.updatedAt)
    : query.sort === "liked" ? desc(likeCount) : desc(Quote.createdAt);
  const offset = (query.page - 1) * ADMIN_CONTENT_PAGE_SIZE;
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: Quote.id, content: Quote.content, imageKey: Quote.imageKey, page: Quote.page,
      background: Quote.background,
      createdAt: Quote.createdAt, updatedAt: Quote.updatedAt, likeCount,
      bookId: Book.id, bookTitle: Book.title, bookSlug: Book.slug,
      userId: User.id, userName: User.name, username: User.username, userEmail: User.email,
      profileVisibility: User.profileVisibility,
    }).from(Quote).innerJoin(Book, eq(Quote.bookId, Book.id)).innerJoin(User, eq(Quote.userId, User.id))
      .leftJoin(QuoteLike, eq(QuoteLike.quoteId, Quote.id)).where(where)
      .groupBy(Quote.id, Book.id, User.id).orderBy(order).limit(ADMIN_CONTENT_PAGE_SIZE).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(Quote)
      .innerJoin(Book, eq(Quote.bookId, Book.id)).innerJoin(User, eq(Quote.userId, User.id)).where(where),
  ]);
  return { rows, total, page: query.page, pageSize: ADMIN_CONTENT_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ADMIN_CONTENT_PAGE_SIZE)) };
}

export async function listAdminNotes(query: AdminContentQuery) {
  const filters: SQL[] = [];
  const q = query.q?.trim();
  if (q) { const search = `%${q}%`; filters.push(or(ilike(PublishedBookNote.content, search), ilike(Book.title, search), ilike(CatalogBook.title, search), ilike(User.name, search), ilike(User.email, search), ilike(User.username, search))!); }
  if (query.userId) filters.push(eq(PublishedBookNote.userId, query.userId));
  if (query.bookId) filters.push(eq(PublishedBookNote.bookId, query.bookId));
  const from = dateValue(query.dateFrom); const to = dateValue(query.dateTo, true);
  if (from) filters.push(gte(PublishedBookNote.createdAt, from)); if (to) filters.push(lte(PublishedBookNote.createdAt, to));
  const where = filters.length ? and(...filters) : undefined;
  const order = query.sort === "oldest" ? asc(PublishedBookNote.createdAt) : query.sort === "updated" ? desc(PublishedBookNote.updatedAt) : desc(PublishedBookNote.createdAt);
  const offset = (query.page - 1) * ADMIN_CONTENT_PAGE_SIZE;
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: PublishedBookNote.id, content: PublishedBookNote.content, scope: PublishedBookNote.scope,
      createdAt: PublishedBookNote.createdAt, updatedAt: PublishedBookNote.updatedAt,
      likeCount: sql<number>`count(${PublishedBookNoteLike.id})::int`,
      bookId: PublishedBookNote.bookId, bookTitle: sql<string>`coalesce(${CatalogBook.title}, ${Book.title}, '—')`,
      userId: User.id, userName: User.name, username: User.username, userEmail: User.email,
      profileVisibility: User.profileVisibility,
    }).from(PublishedBookNote).innerJoin(User, eq(PublishedBookNote.userId, User.id))
      .leftJoin(Book, eq(PublishedBookNote.bookId, Book.id)).leftJoin(CatalogBook, eq(PublishedBookNote.catalogBookId, CatalogBook.id))
      .leftJoin(PublishedBookNoteLike, eq(PublishedBookNoteLike.noteId, PublishedBookNote.id)).where(where)
      .groupBy(PublishedBookNote.id, Book.id, CatalogBook.id, User.id).orderBy(order).limit(ADMIN_CONTENT_PAGE_SIZE).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(PublishedBookNote).innerJoin(User, eq(PublishedBookNote.userId, User.id))
      .leftJoin(Book, eq(PublishedBookNote.bookId, Book.id)).leftJoin(CatalogBook, eq(PublishedBookNote.catalogBookId, CatalogBook.id)).where(where),
  ]);
  return { rows: rows.map(row => ({ ...row, preview: richTextToPlainText(row.content) })), total, page: query.page, pageSize: ADMIN_CONTENT_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ADMIN_CONTENT_PAGE_SIZE)) };
}

export async function adminContentOptions(type: "users" | "books", q: string, _userId?: string) {
  const search = `%${q.trim()}%`;
  if (type === "users") return db.select({ id: User.id, label: sql<string>`coalesce(${User.name}, ${User.username}, ${User.email}, 'کاربر')`, meta: User.email })
    .from(User).where(q.trim() ? or(ilike(User.name, search), ilike(User.username, search), ilike(User.email, search)) : undefined).orderBy(desc(User.createdAt)).limit(20);
  return db.select({ id: Book.id, label: Book.title, meta: Book.author }).from(Book)
    .where(q.trim() ? or(ilike(Book.title, search), ilike(Book.author, search)) : undefined).orderBy(desc(Book.createdAt)).limit(20);
}

async function validBook(bookId: string) {
  const [book] = await db.select({ id: Book.id, catalogBookId: Book.catalogBookId, editionId: Book.editionId }).from(Book).where(eq(Book.id, bookId)).limit(1);
  return book;
}

export async function createAdminQuote(input: { userId: string; bookId: string; content?: unknown; imageKey?: unknown; page?: unknown; background?: unknown }) {
  const book = await validBook(input.bookId); if (!book) throw new Error("کتاب انتخاب‌شده پیدا نشد");
  const content = normalizeQuoteText(input.content); const imageKey = normalizeQuoteImageKey(input.imageKey);
  const background = normalizeQuoteBackground(input.background);
  if (!content && !imageKey) throw new Error("متن یا تصویر تکه لازم است");
  if (imageKey && !isOwnedQuoteImageKey(imageKey, input.userId)) throw new Error("مالک تصویر با کاربر مقصد تطابق ندارد");
  const page = Number(input.page); const validPage = Number.isInteger(page) && page > 0 ? page : null;
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(Quote).values({ userId: input.userId, content, imageKey, page: validPage, background, bookId: book.id, catalogBookId: book.catalogBookId, bookEditionId: book.editionId }).returning();
    await recordPublishedActivity(tx, input.userId, book.id, { quoteId: row.id });
    return row;
  });
}

export async function updateAdminQuote(id: string, input: { userId: string; bookId: string; content?: unknown; imageAction?: unknown; imageKey?: unknown; page?: unknown; background?: unknown }) {
  const [current] = await db.select().from(Quote).where(eq(Quote.id, id)).limit(1); if (!current) throw new Error("تکه پیدا نشد");
  const book = await validBook(input.bookId); if (!book) throw new Error("کتاب انتخاب‌شده پیدا نشد");
  const action = input.imageAction === "remove" || input.imageAction === "replace" ? input.imageAction : "keep";
  const imageKey = action === "keep" ? current.imageKey : action === "remove" ? null : normalizeQuoteImageKey(input.imageKey);
  const content = normalizeQuoteText(input.content); if (!content && !imageKey) throw new Error("تکه نمی‌تواند بدون متن و تصویر باشد");
  if (imageKey && !isOwnedQuoteImageKey(imageKey, input.userId)) throw new Error("مالک تصویر با کاربر مقصد تطابق ندارد");
  const background = Object.prototype.hasOwnProperty.call(input, "background") ? normalizeQuoteBackground(input.background) : normalizeQuoteBackground(current.background);
  const page = Number(input.page); const validPage = Number.isInteger(page) && page > 0 ? page : null;
  const [row] = await db.update(Quote).set({ userId: input.userId, content, imageKey, page: validPage, background, bookId: book.id, catalogBookId: book.catalogBookId, bookEditionId: book.editionId, updatedAt: new Date() }).where(eq(Quote.id, id)).returning();
  if (current.imageKey && current.imageKey !== imageKey) deleteImageUpload(current.imageKey).catch(error => console.error("[admin quotes] previous image cleanup failed", { id, error }));
  return row;
}

export async function deleteAdminQuote(id: string) {
  const [row] = await db.delete(Quote).where(eq(Quote.id, id)).returning({ imageKey: Quote.imageKey }); if (!row) throw new Error("تکه پیدا نشد");
  if (row.imageKey) deleteImageUpload(row.imageKey).catch(error => console.error("[admin quotes] deleted image cleanup failed", { id, error }));
}

export async function createAdminNote(input: { userId: string; bookId: string; content?: unknown; scope?: unknown }) {
  const book = await validBook(input.bookId); if (!book || !book.catalogBookId) throw new Error("کتاب مقصد باید به کاتالوگ متصل باشد");
  const content = sanitizeRichTextHtml(typeof input.content === "string" ? input.content : ""); const validation = noteContentSchema.safeParse(content); if (!validation.success) throw new Error(validation.error.issues[0]?.message ?? "متن یادداشت نامعتبر است");
  const scope = input.scope === "edition" && book.editionId ? "edition" : "book";
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(PublishedBookNote).values({ userId: input.userId, bookId: book.id, catalogBookId: book.catalogBookId, bookEditionId: scope === "edition" ? book.editionId : null, scope, content }).returning();
    await recordPublishedActivity(tx, input.userId, book.id, { noteId: row.id });
    return row;
  });
}

export async function updateAdminNote(id: string, input: { userId: string; bookId: string; content?: unknown; scope?: unknown }) {
  const book = await validBook(input.bookId); if (!book || !book.catalogBookId) throw new Error("کتاب مقصد باید به کاتالوگ متصل باشد");
  const content = sanitizeRichTextHtml(typeof input.content === "string" ? input.content : ""); const validation = noteContentSchema.safeParse(content); if (!validation.success) throw new Error(validation.error.issues[0]?.message ?? "متن یادداشت نامعتبر است");
  const scope = input.scope === "edition" && book.editionId ? "edition" : "book";
  const [row] = await db.update(PublishedBookNote).set({ userId: input.userId, bookId: book.id, catalogBookId: book.catalogBookId, bookEditionId: scope === "edition" ? book.editionId : null, scope, content, updatedAt: new Date() }).where(eq(PublishedBookNote.id, id)).returning(); if (!row) throw new Error("یادداشت پیدا نشد"); return row;
}

export async function deleteAdminNote(id: string) { const rows = await db.delete(PublishedBookNote).where(eq(PublishedBookNote.id, id)).returning({ id: PublishedBookNote.id }); if (!rows.length) throw new Error("یادداشت پیدا نشد"); }
