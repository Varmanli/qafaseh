import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { Book } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bookCreateSchema = z.object({
  title: z.string().trim().min(1, "عنوان کتاب الزامی است").max(255),
  coverImage: z.string().trim().min(1, "تصویر جلد الزامی است").max(1000),
  author: z.string().trim().min(1, "نام نویسنده الزامی است").max(255),
  translator: z.string().trim().max(255).nullish(),
  description: z.string().trim().max(5000).nullish(),
  country: z.string().trim().max(100).nullish(),
  genre: z.string().trim().min(1, "ژانر الزامی است").max(100),
  pageCount: z.number().int().positive().nullish(),
  format: z.enum(["PHYSICAL", "ELECTRONIC"]).default("ELECTRONIC"),
  publisher: z.string().trim().max(255).nullish(),
  status: z.enum(["UNREAD", "READING", "PAUSED", "STOPPED", "FINISHED"]).default("UNREAD"),
  progress: z.number().min(0).max(100).default(0),
  rating: z.number().min(1).max(5).nullish(),
  review: z.string().trim().max(5000).nullish(),
});

// 📌 ایجاد کتاب جدید
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت نشده" },
        { status: 401 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "داده‌های ارسالی نامعتبر است" }, { status: 400 });
    }

    const parsed = bookCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "اطلاعات کتاب نامعتبر است" },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const [newBook] = await db
      .insert(Book)
      .values({
        title: data.title,
        coverImage: data.coverImage,
        author: data.author,
        translator: data.translator || null,
        description: data.description || null,
        country: data.country || null,
        genre: data.genre,
        pageCount: data.pageCount || null,
        format: data.format ?? "ELECTRONIC",
        publisher: data.publisher || null,
        status: data.status,
        progress: data.progress ?? 0,
        rating: data.rating || null,
        review: data.review || null,
        userId: user.id,
      })
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
        rating: Book.rating,
        review: Book.review,
      });

    return NextResponse.json(
      { book: newBook, message: "کتاب ایجاد شد" },
      { status: 201 }
    );
  } catch (err) {
    console.error("❌ خطا در ایجاد کتاب:", err);
    return NextResponse.json({ error: "خطا در ایجاد کتاب" }, { status: 500 });
  }
}

// 📌 گرفتن لیست کتاب‌های کاربر
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    }

    const userBooks = await db
      .select()
      .from(Book)
      .where(eq(Book.userId, user.id))
      .orderBy(desc(Book.createdAt));

    const response = NextResponse.json({ Book: userBooks });

    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "خطا در دریافت کتاب‌ها" },
      { status: 500 }
    );
  }
}
