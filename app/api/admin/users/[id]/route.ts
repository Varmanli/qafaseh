import { and, count, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db } from "@/db";
import { Book, PersonalBookNote, PublicBookThought, User } from "@/db/schema";
import { apiError, apiSuccess } from "@/lib/api/response";
import { assertAdminApi } from "@/lib/admin/permissions";
import { adminUpdateUserSchema } from "@/lib/validations/admin";
import { isUsernameAvailable } from "@/lib/profile/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const [[user], [books], [read], [notes], [thoughts], activityRows] = await Promise.all([
    db.select({ id: User.id, name: User.name, username: User.username, email: User.email, image: User.image, bio: User.bio, role: User.role, createdAt: User.createdAt }).from(User).where(eq(User.id, id)).limit(1),
    db.select({ value: count() }).from(Book).where(eq(Book.userId, id)),
    db.select({ value: count() }).from(Book).where(and(eq(Book.userId, id), eq(Book.status, "FINISHED"))),
    db.select({ value: count() }).from(PersonalBookNote).where(eq(PersonalBookNote.userId, id)),
    db.select({ value: count() }).from(PublicBookThought).where(eq(PublicBookThought.userId, id)),
    db.execute(sql`
      SELECT * FROM (
        SELECT b.created_at AS "createdAt", 'BOOK_ADDED' AS "type", b.title AS "bookTitle", NULL::text AS "detail"
        FROM "Book" b WHERE b.user_id = ${id}
        UNION ALL
        SELECT b.created_at, 'REVIEW', b.title, LEFT(b.review, 140)
        FROM "Book" b WHERE b.user_id = ${id} AND NULLIF(TRIM(b.review), '') IS NOT NULL
        UNION ALL
        SELECT q.created_at, 'QUOTE', COALESCE(cb.title, b.title), LEFT(q.content, 140)
        FROM "Quote" q LEFT JOIN "CatalogBook" cb ON cb.id = q.catalog_book_id LEFT JOIN "Book" b ON b.id = q.book_id
        WHERE q.user_id = ${id}
        UNION ALL
        SELECT n.created_at, 'NOTE', COALESCE(cb.title, b.title), LEFT(n.content, 140)
        FROM "PersonalBookNote" n LEFT JOIN "CatalogBook" cb ON cb.id = n.book_id LEFT JOIN "Book" b ON b.id = n.book_id
        WHERE n.user_id = ${id}
        UNION ALL
        SELECT t.created_at, 'THOUGHT', cb.title, LEFT(t.content, 140)
        FROM "PublicBookThought" t JOIN "CatalogBook" cb ON cb.id = t.catalog_book_id
        WHERE t.user_id = ${id}
        UNION ALL
        SELECT e.created_at, 'READING', b.title, e.type::text
        FROM "ReadingEvent" e JOIN "Book" b ON b.id = e.book_id
        WHERE e.user_id = ${id}
      ) activity ORDER BY "createdAt" DESC LIMIT 30
    `),
  ]);
  if (!user) return apiError("کاربر پیدا نشد", 404, "NOT_FOUND");
  return apiSuccess({ user, activity: { books: books.value, read: read.value, notes: notes.value, thoughts: thoughts.value }, recentActivities: activityRows.rows });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  const input = parsed.data;
  if (input.username && !(await isUsernameAvailable(input.username, id))) return apiError("این نام کاربری قبلاً انتخاب شده است", 409, "USERNAME_TAKEN");
  try {
    const [user] = await db.update(User).set({ ...input, updatedAt: new Date() }).where(eq(User.id, id)).returning({ id: User.id });
    if (!user) return apiError("کاربر پیدا نشد", 404, "NOT_FOUND");
  } catch { return apiError("ذخیره اطلاعات ناموفق بود", 422, "UPDATE_FAILED"); }
  return apiSuccess({ message: "اطلاعات کاربر ذخیره شد" });
}
