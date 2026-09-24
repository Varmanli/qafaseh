import { and, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { CatalogBook, ReadingList, ReadingListItem, ReadingListRelated } from "@/db/schema";
import { publicCatalogBookCondition } from "@/lib/book/discover-service";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import type { ReadingListInput } from "@/lib/validations/reading-lists";

export class ReadingListError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function normalizedItems(items: ReadingListInput["items"]) {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

export async function listAdminReadingLists(filters: { q?: string; mode?: "ORDERED" | "UNORDERED"; status?: "DRAFT" | "PUBLISHED"; category?: string }) {
  const conditions = [
    filters.q ? ilike(ReadingList.title, `%${filters.q}%`) : undefined,
    filters.mode ? eq(ReadingList.mode, filters.mode) : undefined,
    filters.status ? eq(ReadingList.status, filters.status) : undefined,
    filters.category ? eq(ReadingList.hubGroup, filters.category) : undefined,
  ].filter((condition) => condition !== undefined);
  return db.select({
    id: ReadingList.id, title: ReadingList.title, slug: ReadingList.slug,
    mode: ReadingList.mode, category: ReadingList.category, hubGroup: ReadingList.hubGroup,
    status: ReadingList.status, featured: ReadingList.featured,
    updatedAt: ReadingList.updatedAt,
    bookCount: count(ReadingListItem.id),
  }).from(ReadingList).leftJoin(ReadingListItem, eq(ReadingListItem.listId, ReadingList.id))
    .where(and(...conditions)).groupBy(ReadingList.id)
    .orderBy(desc(ReadingList.updatedAt)).limit(200);
}

export async function getAdminReadingList(id: string) {
  const [list] = await db.select().from(ReadingList).where(eq(ReadingList.id, id)).limit(1);
  if (!list) return null;
  const [items, edges] = await Promise.all([
    db.select({ id: ReadingListItem.id, bookId: ReadingListItem.bookId,
      position: ReadingListItem.position, note: ReadingListItem.note,
      difficulty: ReadingListItem.difficulty, title: CatalogBook.title,
      author: CatalogBook.author, coverImage: displayCoverFieldSql(), status: CatalogBook.status,
    }).from(ReadingListItem).innerJoin(CatalogBook, eq(ReadingListItem.bookId, CatalogBook.id))
      .where(eq(ReadingListItem.listId, id)).orderBy(ReadingListItem.position),
    db.select({ id: ReadingListRelated.relatedListId }).from(ReadingListRelated)
      .where(eq(ReadingListRelated.sourceListId, id)).orderBy(ReadingListRelated.position),
  ]);
  return { ...list, items, relatedListIds: edges.map((edge) => edge.id) };
}

export async function getAdminRelatedOptions(excludeId?: string) {
  return db.select({ id: ReadingList.id, title: ReadingList.title, status: ReadingList.status })
    .from(ReadingList).where(excludeId ? ne(ReadingList.id, excludeId) : undefined)
    .orderBy(ReadingList.title).limit(200);
}

export async function searchReadingListBooks(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  return db.select({ id: CatalogBook.id, title: CatalogBook.title,
    author: CatalogBook.author, coverImage: displayCoverFieldSql(),
  }).from(CatalogBook)
    .where(and(publicCatalogBookCondition, or(ilike(CatalogBook.title, `%${term}%`), ilike(CatalogBook.author, `%${term}%`))))
    .orderBy(CatalogBook.title).limit(15);
}

async function validateReferences(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], input: ReadingListInput, id?: string) {
  if (id && input.relatedListIds.includes(id)) throw new ReadingListError("SELF_RELATED", "لیست نمی‌تواند به خودش مرتبط شود");
  const bookIds = input.items.map((item) => item.bookId);
  const books = bookIds.length ? await tx.select({ id: CatalogBook.id }).from(CatalogBook).where(inArray(CatalogBook.id, bookIds)) : [];
  if (books.length !== bookIds.length) throw new ReadingListError("BOOK_NOT_FOUND", "یکی از کتاب‌ها دیگر وجود ندارد");
  if (input.status === "PUBLISHED") {
    const publicBooks = bookIds.length ? await tx.select({ id: CatalogBook.id }).from(CatalogBook)
      .where(and(inArray(CatalogBook.id, bookIds), publicCatalogBookCondition)) : [];
    if (!publicBooks.length) throw new ReadingListError("EMPTY_PUBLIC", "برای انتشار، حداقل یک کتاب عمومی لازم است");
  }
  const related = input.relatedListIds.length ? await tx.select({ id: ReadingList.id }).from(ReadingList)
    .where(inArray(ReadingList.id, input.relatedListIds)) : [];
  if (related.length !== input.relatedListIds.length) throw new ReadingListError("RELATED_NOT_FOUND", "یکی از لیست‌های مرتبط وجود ندارد");
}

export async function saveReadingList(input: ReadingListInput, id?: string) {
  return db.transaction(async (tx) => {
    const [conflict] = await tx.select({ id: ReadingList.id }).from(ReadingList)
      .where(eq(ReadingList.slug, input.slug)).limit(1);
    if (conflict && conflict.id !== id) throw new ReadingListError("DUPLICATE_SLUG", "این اسلاگ قبلاً استفاده شده است");
    let publishedAt: Date | null = null;
    if (id) {
      const [existing] = await tx.select({ id: ReadingList.id, publishedAt: ReadingList.publishedAt })
        .from(ReadingList).where(eq(ReadingList.id, id)).limit(1);
      if (!existing) throw new ReadingListError("NOT_FOUND", "لیست پیدا نشد");
      publishedAt = existing.publishedAt;
    }
    await validateReferences(tx, input, id);
    const now = new Date();
    const values = {
      title: input.title, slug: input.slug, description: input.description,
      audience: input.audience, category: input.category, hubGroup: input.hubGroup,
      mode: input.mode, status: input.status, featured: input.featured,
      seoTitle: input.seoTitle, seoDescription: input.seoDescription,
      publishedAt: input.status === "PUBLISHED" ? publishedAt ?? now : null,
      updatedAt: now,
    };
    const [list] = id
      ? await tx.update(ReadingList).set(values).where(eq(ReadingList.id, id)).returning({ id: ReadingList.id, slug: ReadingList.slug })
      : await tx.insert(ReadingList).values(values).returning({ id: ReadingList.id, slug: ReadingList.slug });
    if (id) {
      await tx.delete(ReadingListItem).where(eq(ReadingListItem.listId, list.id));
      await tx.delete(ReadingListRelated).where(eq(ReadingListRelated.sourceListId, list.id));
    }
    if (input.items.length) await tx.insert(ReadingListItem).values(normalizedItems(input.items).map((item) => ({
      listId: list.id, bookId: item.bookId, position: item.position,
      note: item.note, difficulty: item.difficulty,
    })));
    if (input.relatedListIds.length) await tx.insert(ReadingListRelated).values(input.relatedListIds.map((relatedListId, position) => ({
      sourceListId: list.id, relatedListId, position: position + 1,
    })));
    return list;
  });
}

export async function setReadingListStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  return db.transaction(async (tx) => {
    const [list] = await tx.select({ id: ReadingList.id, publishedAt: ReadingList.publishedAt })
      .from(ReadingList).where(eq(ReadingList.id, id)).limit(1);
    if (!list) throw new ReadingListError("NOT_FOUND", "لیست پیدا نشد");
    if (status === "PUBLISHED") {
      const [valid] = await tx.select({ n: count() }).from(ReadingListItem)
        .innerJoin(CatalogBook, eq(ReadingListItem.bookId, CatalogBook.id))
        .where(and(eq(ReadingListItem.listId, id), publicCatalogBookCondition));
      if (!valid?.n) throw new ReadingListError("EMPTY_PUBLIC", "برای انتشار، حداقل یک کتاب عمومی لازم است");
    }
    await tx.update(ReadingList).set({ status, publishedAt: status === "PUBLISHED" ? list.publishedAt ?? new Date() : null, updatedAt: new Date() })
      .where(eq(ReadingList.id, id));
  });
}

export async function deleteReadingList(id: string) {
  const rows = await db.delete(ReadingList).where(eq(ReadingList.id, id)).returning({ id: ReadingList.id });
  if (!rows.length) throw new ReadingListError("NOT_FOUND", "لیست پیدا نشد");
}
