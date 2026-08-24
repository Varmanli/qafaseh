import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { Wishlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const wishlistCreateSchema = z.object({
  title: z.string().trim().min(1, "عنوان کتاب الزامی است").max(255),
  author: z.string().trim().min(1, "نام نویسنده الزامی است").max(255),
  publisher: z.string().trim().max(255).nullish(),
  genre: z.string().trim().max(100).nullish(),
  translator: z.string().trim().max(255).nullish(),
  note: z.string().trim().max(1000).nullish(),
  priority: z.enum([
    "MUST_HAVE",
    "WANT_IT",
    "NICE_TO_HAVE",
    "IF_EXTRA_MONEY",
    "NOT_IMPORTANT",
  ]),
});

// 📌 ایجاد آیتم جدید در Wishlist
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
      return NextResponse.json(
        { error: "داده‌های ارسالی نامعتبر است" },
        { status: 400 }
      );
    }

    const parsed = wishlistCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "داده‌های نامعتبر" },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const [newWishlist] = await db
      .insert(Wishlist)
      .values({
        userId: user.id,
        title: data.title,
        author: data.author,
        publisher: data.publisher || null,
        genre: data.genre || null,
        translator: data.translator || null,
        note: data.note || null,
        priority: data.priority,
      })
      .returning();

    return NextResponse.json(
      { wishlist: newWishlist, message: "آیتم به لیست علاقه‌مندی‌ها اضافه شد" },
      { status: 201 }
    );
  } catch (err) {
    console.error("❌ خطا در ایجاد آیتم Wishlist:", err);
    return NextResponse.json({ error: "خطا در ایجاد آیتم" }, { status: 500 });
  }
}

// 📌 گرفتن لیست Wishlist کاربر
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت نشده" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    let orderBy;
    switch (sortBy) {
      case "title":
        orderBy =
          sortOrder === "asc" ? asc(Wishlist.title) : desc(Wishlist.title);
        break;
      case "author":
        orderBy =
          sortOrder === "asc" ? asc(Wishlist.author) : desc(Wishlist.author);
        break;
      case "publisher":
        orderBy =
          sortOrder === "asc"
            ? asc(Wishlist.publisher)
            : desc(Wishlist.publisher);
        break;
      case "genre":
        orderBy =
          sortOrder === "asc" ? asc(Wishlist.genre) : desc(Wishlist.genre);
        break;
      case "priority":
        orderBy =
          sortOrder === "asc"
            ? asc(Wishlist.priority)
            : desc(Wishlist.priority);
        break;
      case "createdAt":
      default:
        orderBy =
          sortOrder === "asc"
            ? asc(Wishlist.createdAt)
            : desc(Wishlist.createdAt);
        break;
    }

    const userWishlist = await db
      .select()
      .from(Wishlist)
      .where(eq(Wishlist.userId, user.id))
      .orderBy(orderBy);

    const response = NextResponse.json({
      wishlist: userWishlist,
      total: userWishlist.length,
      sortBy,
      sortOrder,
    });

    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");

    return response;
  } catch (err) {
    console.error("❌ خطا در دریافت Wishlist:", err);
    return NextResponse.json(
      { error: "خطا در دریافت لیست علاقه‌مندی‌ها" },
      { status: 500 }
    );
  }
}
