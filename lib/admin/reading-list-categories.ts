import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { ReadingList, ReadingListCategory } from "@/db/schema";
import type { ReadingListCategoryInput } from "@/lib/validations/reading-list-categories";

export class ReadingListCategoryError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function listReadingListCategories() {
  return db.select({
    id: ReadingListCategory.id,
    name: ReadingListCategory.name,
    updatedAt: ReadingListCategory.updatedAt,
    listCount: count(ReadingList.id),
  }).from(ReadingListCategory)
    .leftJoin(ReadingList, eq(ReadingList.category, ReadingListCategory.name))
    .groupBy(ReadingListCategory.id)
    .orderBy(ReadingListCategory.name);
}

export async function getReadingListCategoryOptions() {
  return db.select({ id: ReadingListCategory.id, name: ReadingListCategory.name })
    .from(ReadingListCategory).orderBy(ReadingListCategory.name);
}

export async function createReadingListCategory(input: ReadingListCategoryInput) {
  const [category] = await db.insert(ReadingListCategory).values({ name: input.name }).returning();
  return category;
}

export async function updateReadingListCategory(id: string, input: ReadingListCategoryInput) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ name: ReadingListCategory.name })
      .from(ReadingListCategory).where(eq(ReadingListCategory.id, id)).limit(1);
    if (!existing) throw new ReadingListCategoryError("NOT_FOUND", "دسته‌بندی پیدا نشد");
    const [category] = await tx.update(ReadingListCategory)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(ReadingListCategory.id, id)).returning();
    if (existing.name !== input.name) {
      await tx.update(ReadingList).set({ category: input.name, updatedAt: new Date() })
        .where(eq(ReadingList.category, existing.name));
    }
    return category;
  });
}

export async function deleteReadingListCategory(id: string) {
  const [category] = await db.select({ id: ReadingListCategory.id, name: ReadingListCategory.name })
    .from(ReadingListCategory).where(eq(ReadingListCategory.id, id)).limit(1);
  if (!category) throw new ReadingListCategoryError("NOT_FOUND", "دسته‌بندی پیدا نشد");
  const [usage] = await db.select({ count: count() }).from(ReadingList)
    .where(eq(ReadingList.category, category.name));
  if (usage.count) throw new ReadingListCategoryError("IN_USE", "این دسته‌بندی به فهرست‌ها متصل است؛ ابتدا دستهٔ آن فهرست‌ها را تغییر بده");
  await db.delete(ReadingListCategory).where(eq(ReadingListCategory.id, id));
}
