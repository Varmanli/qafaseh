import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { Book, PersonalBookNote, PublicBookThought } from "@/db/schema";

export async function getPersonalBookNotes(bookId: string, userId: string) {
  return db
    .select({
      id: PersonalBookNote.id,
      content: PersonalBookNote.content,
      pageNumber: PersonalBookNote.pageNumber,
      createdAt: PersonalBookNote.createdAt,
      updatedAt: PersonalBookNote.updatedAt,
      publicThoughtId: PublicBookThought.id,
    })
    .from(PersonalBookNote)
    .leftJoin(
      PublicBookThought,
      eq(PublicBookThought.sourcePersonalNoteId, PersonalBookNote.id),
    )
    .where(and(eq(PersonalBookNote.bookId, bookId), eq(PersonalBookNote.userId, userId)))
    .orderBy(desc(PersonalBookNote.createdAt));
}

export async function countPersonalBookNotes(bookId: string, userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(PersonalBookNote)
    .where(and(eq(PersonalBookNote.bookId, bookId), eq(PersonalBookNote.userId, userId)));
  return result?.count ?? 0;
}

export async function assertOwnedBook(bookId: string, userId: string) {
  const [book] = await db.select({ id: Book.id, pageCount: Book.pageCount }).from(Book).where(and(eq(Book.id, bookId), eq(Book.userId, userId))).limit(1);
  return book ?? null;
}

export async function createPersonalBookNote(input: { bookId: string; userId: string; content: string; pageNumber: number | null }) {
  const [note] = await db.insert(PersonalBookNote).values(input).returning();
  return note;
}

export async function updatePersonalBookNote(id: string, userId: string, input: { content: string; pageNumber: number | null }) {
  const [note] = await db.update(PersonalBookNote).set({ ...input, updatedAt: new Date() }).where(and(eq(PersonalBookNote.id, id), eq(PersonalBookNote.userId, userId))).returning();
  return note ?? null;
}

export async function getOwnedPersonalBookNote(id: string, userId: string) {
  const [note] = await db.select({ id: PersonalBookNote.id, bookId: PersonalBookNote.bookId }).from(PersonalBookNote).where(and(eq(PersonalBookNote.id, id), eq(PersonalBookNote.userId, userId))).limit(1);
  return note ?? null;
}

export async function deletePersonalBookNote(id: string, userId: string) {
  const rows = await db.delete(PersonalBookNote).where(and(eq(PersonalBookNote.id, id), eq(PersonalBookNote.userId, userId))).returning({ id: PersonalBookNote.id });
  return rows.length > 0;
}
