import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { Book, Quote } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isOwnedQuoteImageKey,
  normalizeQuoteImageKey,
  normalizeQuoteText,
} from "@/lib/quotes/image";
import {
  normalizeQuoteBackground,
} from "@/lib/quotes/backgrounds";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const content = normalizeQuoteText(body.content);
    const imageKey = normalizeQuoteImageKey(body.imageKey);

    const bookId = typeof body.bookId === "string" ? body.bookId : "";

    const page =
      typeof body.page === "number" &&
      Number.isInteger(body.page) &&
      body.page > 0
        ? body.page
        : null;

    const background = normalizeQuoteBackground(body.background);

    if (!content && !imageKey) {
      return NextResponse.json(
        { error: "متن یا تصویر تکه لازم است" },
        { status: 422 },
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: "شناسه کتاب لازم است" },
        { status: 400 },
      );
    }

    if (imageKey && !isOwnedQuoteImageKey(imageKey, user.id)) {
      return NextResponse.json(
        { error: "تصویر انتخاب‌شده معتبر نیست" },
        { status: 403 },
      );
    }

    if (imageKey) {
      const [alreadyAttached] = await db
        .select({ id: Quote.id })
        .from(Quote)
        .where(eq(Quote.imageKey, imageKey))
        .limit(1);

      if (alreadyAttached) {
        return NextResponse.json(
          { error: "این تصویر قبلاً به تکه دیگری متصل شده است" },
          { status: 409 },
        );
      }
    }

    const [book] = await db
      .select({
        id: Book.id,
        catalogBookId: Book.catalogBookId,
        editionId: Book.editionId,
      })
      .from(Book)
      .where(and(eq(Book.id, bookId), eq(Book.userId, user.id)));

    if (!book) {
      return NextResponse.json({ error: "کتاب در قفسه شما پیدا نشد" }, { status: 404 });
    }

    const [quote] = await db
      .insert(Quote)
      .values({
        userId: user.id,
        content,
        imageKey,
        page,
        background,
        bookId,
        catalogBookId: book.catalogBookId,
        bookEditionId: book.editionId,
      })
      .returning();

    return NextResponse.json({
      quote,
      message: "تکه با موفقیت اضافه شد",
    });
  } catch (error) {
    console.error("❌ خطا در ایجاد تکه:", error);

    return NextResponse.json({ error: "خطا در ایجاد تکه" }, { status: 500 });
  }
}
