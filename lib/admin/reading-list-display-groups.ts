import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { ReadingList, ReadingListDisplayGroup } from "@/db/schema";
import type { ReadingListCategoryInput } from "@/lib/validations/reading-list-categories";

export class ReadingListDisplayGroupError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function listReadingListDisplayGroups() {
  return db.select({
    id: ReadingListDisplayGroup.id,
    name: ReadingListDisplayGroup.name,
    updatedAt: ReadingListDisplayGroup.updatedAt,
    listCount: count(ReadingList.id),
  }).from(ReadingListDisplayGroup)
    .leftJoin(ReadingList, eq(ReadingList.hubGroup, ReadingListDisplayGroup.name))
    .groupBy(ReadingListDisplayGroup.id)
    .orderBy(ReadingListDisplayGroup.name);
}

export async function getReadingListDisplayGroupOptions() {
  return db.select({ id: ReadingListDisplayGroup.id, name: ReadingListDisplayGroup.name })
    .from(ReadingListDisplayGroup).orderBy(ReadingListDisplayGroup.name);
}

export async function createReadingListDisplayGroup(input: ReadingListCategoryInput) {
  const [group] = await db.insert(ReadingListDisplayGroup).values({ name: input.name }).returning();
  return group;
}

export async function updateReadingListDisplayGroup(id: string, input: ReadingListCategoryInput) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ name: ReadingListDisplayGroup.name })
      .from(ReadingListDisplayGroup).where(eq(ReadingListDisplayGroup.id, id)).limit(1);
    if (!existing) throw new ReadingListDisplayGroupError("NOT_FOUND", "گروه نمایش پیدا نشد");
    const [group] = await tx.update(ReadingListDisplayGroup)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(ReadingListDisplayGroup.id, id)).returning();
    if (existing.name !== input.name) {
      await tx.update(ReadingList).set({ hubGroup: input.name, updatedAt: new Date() })
        .where(eq(ReadingList.hubGroup, existing.name));
    }
    return group;
  });
}

export async function deleteReadingListDisplayGroup(id: string) {
  const [group] = await db.select({ id: ReadingListDisplayGroup.id, name: ReadingListDisplayGroup.name })
    .from(ReadingListDisplayGroup).where(eq(ReadingListDisplayGroup.id, id)).limit(1);
  if (!group) throw new ReadingListDisplayGroupError("NOT_FOUND", "گروه نمایش پیدا نشد");
  const [usage] = await db.select({ count: count() }).from(ReadingList)
    .where(eq(ReadingList.hubGroup, group.name));
  if (usage.count) throw new ReadingListDisplayGroupError("IN_USE", "این گروه به فهرست‌ها متصل است؛ ابتدا گروه آن فهرست‌ها را تغییر بده");
  await db.delete(ReadingListDisplayGroup).where(eq(ReadingListDisplayGroup.id, id));
}
