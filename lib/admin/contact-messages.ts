import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { ContactMessage } from "@/db/schema";

export type NewContactMessage = {
  name: string;
  email: string;
  topic: string;
  message: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookTranslator?: string;
  bookReference?: string;
};

export async function createContactMessage(input: NewContactMessage) {
  const [message] = await db.insert(ContactMessage).values({
    ...input,
    bookTitle: input.bookTitle || null,
    bookAuthor: input.bookAuthor || null,
    bookTranslator: input.bookTranslator || null,
    bookReference: input.bookReference || null,
  }).returning({ id: ContactMessage.id });

  return message;
}

export async function listContactMessages({
  page,
  pageSize,
  q,
  topic,
  status,
}: {
  page: number;
  pageSize: number;
  q?: string;
  topic?: string;
  status?: "all" | "unread" | "read";
}) {
  const search = q?.trim().replace(/[\\%_]/g, "\\$&");
  const where = and(
    topic ? eq(ContactMessage.topic, topic) : undefined,
    status === "unread" ? eq(ContactMessage.isRead, false) : undefined,
    status === "read" ? eq(ContactMessage.isRead, true) : undefined,
    search
      ? or(
          ilike(ContactMessage.name, `%${search}%`),
          ilike(ContactMessage.email, `%${search}%`),
          ilike(ContactMessage.message, `%${search}%`),
          ilike(ContactMessage.bookTitle, `%${search}%`),
          ilike(ContactMessage.bookAuthor, `%${search}%`),
        )
      : undefined,
  );

  const [totalResult, unreadResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ContactMessage).where(where),
    db.select({ count: sql<number>`count(*)::int` }).from(ContactMessage).where(eq(ContactMessage.isRead, false)),
    db.select().from(ContactMessage).where(where)
      .orderBy(desc(ContactMessage.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { rows, total: totalResult[0]?.count ?? 0, unreadTotal: unreadResult[0]?.count ?? 0 };
}

export async function setContactMessageRead(id: string, isRead: boolean) {
  const [row] = await db.update(ContactMessage).set({ isRead })
    .where(eq(ContactMessage.id, id))
    .returning({ id: ContactMessage.id });
  return row ?? null;
}

export async function deleteContactMessage(id: string) {
  const [row] = await db.delete(ContactMessage).where(eq(ContactMessage.id, id))
    .returning({ id: ContactMessage.id });
  return row ?? null;
}
