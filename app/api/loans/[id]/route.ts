import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { Book, BookLoan } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { loanUpdateSchema } from "@/lib/validations/loans";

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const { id } = await params;
  const parsed = loanUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });
  const data = parsed.data;
  try {
    const [current] = await db.select({ returnedAt: BookLoan.returnedAt, bookId: BookLoan.bookId }).from(BookLoan)
      .where(and(eq(BookLoan.id, id), eq(BookLoan.userId, user.id))).limit(1);
    if (!current) return NextResponse.json({ error: "امانت پیدا نشد" }, { status: 404 });
    const [owned] = data.bookId ? await db.select({ id: Book.id, title: Book.title, author: Book.author }).from(Book)
      .where(and(eq(Book.id, data.bookId), eq(Book.userId, user.id), eq(Book.format, "PHYSICAL"))).limit(1) : [];
    if ((!data.bookId && current.bookId) || (data.bookId && !owned)) return NextResponse.json({ error: "کتاب در کتابخانه‌ات پیدا نشد" }, { status: 404 });
    const [loan] = await db.update(BookLoan).set({
      bookId: data.bookId, bookTitle: owned?.title ?? undefined, bookAuthor: owned?.author ?? undefined, borrowerName: data.borrowerName,
      loanedAt: new Date(`${data.loanedAt}T12:00:00Z`),
      dueAt: data.dueAt ? new Date(`${data.dueAt}T12:00:00Z`) : null,
      note: data.note, returnedAt: data.returned ? (current.returnedAt ?? new Date()) : null,
    }).where(and(eq(BookLoan.id, id), eq(BookLoan.userId, user.id))).returning();
    if (!loan) return NextResponse.json({ error: "امانت پیدا نشد" }, { status: 404 });
    return NextResponse.json({ loan });
  } catch (error) {
    console.error("Loan update failed", error);
    return NextResponse.json({ error: "ویرایش امانت ناموفق بود" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const { id } = await params;
  try {
    const [deleted] = await db.delete(BookLoan)
      .where(and(eq(BookLoan.id, id), eq(BookLoan.userId, user.id))).returning({ id: BookLoan.id });
    if (!deleted) return NextResponse.json({ error: "امانت پیدا نشد" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Loan delete failed", error);
    return NextResponse.json({ error: "حذف امانت ناموفق بود" }, { status: 500 });
  }
}
