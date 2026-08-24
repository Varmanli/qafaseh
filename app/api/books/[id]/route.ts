import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { Book, Quote } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { parseUserBookUpdate, type UserBookUpdate } from "@/lib/book/user-mutation";

export const dynamic = "force-dynamic";

// GET: گرفتن جزئیات یک کتاب (فقط برای مالک)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "شناسه کتاب نامعتبر است" }, { status: 400 });
    }

    const [book] = await db
      .select()
      .from(Book)
      .where(and(eq(Book.id, id), eq(Book.userId, user.id)))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
    }

    // گرفتن تکه‌های متصل به این کتاب (فقط متعلق به همین کاربر)
    const quotes = await db
      .select()
      .from(Quote)
      .where(and(eq(Quote.bookId, id), eq(Quote.userId, user.id)))
      .orderBy(Quote.id);

    return NextResponse.json({
      book: {
        ...book,
        quotes,
      },
    });
  } catch (err) {
    console.error("❌ خطا در دریافت کتاب:", err);
    return NextResponse.json({ error: "خطا در دریافت کتاب" }, { status: 500 });
  }
}

// PUT: بروزرسانی داده‌های شخصیِ کتاب (فقط برای مالک)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "شناسه کتاب نامعتبر است" }, { status: 400 });
    }

    const [book] = await db
      .select()
      .from(Book)
      .where(and(eq(Book.id, id), eq(Book.userId, user.id)))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
    }

    const parsed = parseUserBookUpdate(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }
    const updateData: UserBookUpdate & { completedAt?: Date | null } = { ...parsed.data };

    if (updateData.status === "FINISHED") {
      updateData.completedAt = book.completedAt ?? new Date();
    } else if (updateData.status) {
      updateData.completedAt = null;
    }

    const [updatedBook] = await db
      .update(Book)
      .set(updateData)
      .where(and(eq(Book.id, id), eq(Book.userId, user.id)))
      .returning({
        id: Book.id,
        title: Book.title,
        author: Book.author,
        genre: Book.genre,
        userId: Book.userId,
        createdAt: Book.createdAt,
        coverImage: Book.coverImage,
        translator: Book.translator,
        description: Book.description,
        country: Book.country,
        pageCount: Book.pageCount,
        format: Book.format,
        publisher: Book.publisher,
        status: Book.status,
        progress: Book.progress,
        currentPage: Book.currentPage,
        completedAt: Book.completedAt,
        rating: Book.rating,
        review: Book.review,
        moodTags: Book.moodTags,
      });

    return NextResponse.json({
      book: updatedBook,
      message: "کتاب بروزرسانی شد",
    });
  } catch (err) {
    console.error("❌ خطا در بروزرسانی کتاب:", err);
    return NextResponse.json(
      { error: "خطا در بروزرسانی کتاب" },
      { status: 500 }
    );
  }
}

// DELETE: حذف کتاب (فقط برای مالک)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "شناسه کتاب نامعتبر است" }, { status: 400 });
    }

    const [deletedBook] = await db
      .delete(Book)
      .where(and(eq(Book.id, id), eq(Book.userId, user.id)))
      .returning({ id: Book.id });

    if (!deletedBook) {
      return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ message: "کتاب با موفقیت حذف شد" });
  } catch (err) {
    console.error("❌ خطا در حذف کتاب:", err);
    return NextResponse.json({ error: "خطا در حذف کتاب" }, { status: 500 });
  }
}

