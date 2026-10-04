import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { db } from "@/db";
import { Book, ReadingEvent } from "@/db/schema";
import { recordReadingActivity } from "@/lib/social/activity";

const progressUpdateSchema = z.object({
  currentPage: z.number().int().min(0).optional(),
  pagesRead: z.number().int().positive().optional(),
  status: z.enum(["READING", "PAUSED", "STOPPED", "FINISHED"]).optional(),
}).refine((value) => value.currentPage !== undefined || value.pagesRead !== undefined || value.status !== undefined, {
  message: "یک تغییر برای ثبت لازم است",
}).refine((value) => !(value.currentPage !== undefined && value.pagesRead !== undefined), {
  message: "صفحه فعلی یا صفحات خوانده‌شده را وارد کنید، نه هر دو",
});

function bookIdFromRequest(request: NextRequest) {
  return request.nextUrl.pathname.split("/").at(-2) ?? "";
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "توکن لازم است" }, { status: 401 });

    const { id: userId } = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const parsed = progressUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });
    }

    const id = bookIdFromRequest(request);
    const [book] = await db.select().from(Book).where(eq(Book.id, id)).limit(1);
    if (!book) return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
    if (book.userId !== userId) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

    const { currentPage, pagesRead, status } = parsed.data;
    const requestedPage = currentPage ?? book.currentPage + (pagesRead ?? 0);
    const pageCount = book.pageCount;
    if (pageCount !== null && requestedPage > pageCount) {
      return NextResponse.json({ error: `شماره صفحه نمی‌تواند بیشتر از ${pageCount} باشد` }, { status: 422 });
    }

    const now = new Date();
    // Reaching the final page deliberately does not finish a book by itself.
    // The client asks for confirmation first, then sends status: FINISHED.
    const nextStatus = status ?? (book.status === "READING" ? "READING" : book.status);
    const progress = pageCount && pageCount > 0 ? Math.round((requestedPage / pageCount) * 100) : book.progress;

    const eventType =
      nextStatus === "FINISHED" && book.status !== "FINISHED"
        ? "FINISH"
        : nextStatus === "READING" && book.status === "UNREAD"
          ? "START"
          : requestedPage !== book.currentPage
            ? "PROGRESS"
            : null;
    const eventPagesRead =
      requestedPage > book.currentPage
        ? requestedPage - book.currentPage
        : null;

    const updatedBook = await db.transaction(async (tx) => {
      const [nextBook] = await tx.update(Book).set({
        currentPage: requestedPage,
        progress,
        status: nextStatus,
        readingUpdatedAt: now,
        completedAt: nextStatus === "FINISHED" ? book.completedAt ?? now : null,
      }).where(and(eq(Book.id, id), eq(Book.userId, userId), eq(Book.status, book.status))).returning({
        id: Book.id,
        currentPage: Book.currentPage,
        progress: Book.progress,
        status: Book.status,
        readingUpdatedAt: Book.readingUpdatedAt,
        completedAt: Book.completedAt,
      });
      if (!nextBook) throw new Error("STATUS_CONFLICT");

      if (eventType) {
        await tx.insert(ReadingEvent).values({
          userId,
          bookId: id,
          type: eventType,
          pageFrom: book.currentPage,
          pageTo: requestedPage,
          pagesRead: eventPagesRead,
          createdAt: now,
        });
      }

      await recordReadingActivity(tx, userId, id, book.status, nextStatus);

      return nextBook;
    });

    return NextResponse.json({ book: updatedBook, message: "پیشرفت مطالعه ثبت شد" });
  } catch (error) {
    if (error instanceof Error && error.message === "STATUS_CONFLICT") return NextResponse.json({ error: "وضعیت کتاب تغییر کرده؛ دوباره تلاش کنید" }, { status: 409 });
    if (error instanceof jwt.JsonWebTokenError) return NextResponse.json({ error: "توکن نامعتبر است" }, { status: 401 });
    console.error("reading progress update failed", error);
    return NextResponse.json({ error: "ثبت پیشرفت مطالعه ناموفق بود" }, { status: 500 });
  }
}
