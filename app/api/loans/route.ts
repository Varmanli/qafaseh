import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { Book, BookLoan } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { loanSchema } from "@/lib/validations/loans";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  try {
    const loans = await db.select({
      id: BookLoan.id, bookId: BookLoan.bookId, borrowerName: BookLoan.borrowerName,
      loanedAt: BookLoan.loanedAt, dueAt: BookLoan.dueAt, returnedAt: BookLoan.returnedAt,
      note: BookLoan.note, title: BookLoan.bookTitle, author: BookLoan.bookAuthor,
      coverImage: Book.coverImage,
    }).from(BookLoan)
      .leftJoin(Book, eq(BookLoan.bookId, Book.id))
      .where(eq(BookLoan.userId, user.id))
      .orderBy(desc(BookLoan.loanedAt));
    return NextResponse.json({ loans }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Loan list failed", error);
    return NextResponse.json({ error: "دریافت امانت‌ها ناموفق بود" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = loanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });
  const data = parsed.data;
  try {
    const [owned] = await db.select({ id: Book.id, title: Book.title, author: Book.author }).from(Book)
      .where(and(eq(Book.id, data.bookId), eq(Book.userId, user.id), eq(Book.format, "PHYSICAL"))).limit(1);
    if (!owned) return NextResponse.json({ error: "کتاب فیزیکی در کتابخانه‌ات پیدا نشد" }, { status: 404 });
    const [active] = await db.select({ id: BookLoan.id }).from(BookLoan)
      .where(and(eq(BookLoan.userId, user.id), eq(BookLoan.bookId, data.bookId), isNull(BookLoan.returnedAt))).limit(1);
    if (active) return NextResponse.json({ error: "این کتاب اکنون در امانت است" }, { status: 409 });
    const [loan] = await db.insert(BookLoan).values({
      userId: user.id, bookId: data.bookId, bookTitle: owned.title, bookAuthor: owned.author, borrowerName: data.borrowerName,
      loanedAt: new Date(`${data.loanedAt}T12:00:00Z`),
      dueAt: data.dueAt ? new Date(`${data.dueAt}T12:00:00Z`) : null,
      note: data.note,
    }).returning();
    return NextResponse.json({ loan }, { status: 201 });
  } catch (error) {
    console.error("Loan create failed", error);
    return NextResponse.json({ error: "ثبت امانت ناموفق بود" }, { status: 500 });
  }
}
