import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { BookEdition, CatalogBook, Wishlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const wishlistCreateSchema = z.object({
  title: z.string().trim().min(1, "عنوان کتاب الزامی است").max(255).optional(),
  author: z.string().trim().min(1, "نام نویسنده الزامی است").max(255).optional(),
  catalogBookId: z.string().uuid().optional(),
  publisher: z.string().trim().max(255).nullish(),
  genre: z.string().trim().max(100).nullish(),
  translator: z.string().trim().max(255).nullish(),
  note: z.string().trim().max(1000).nullish(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
}).refine((data) => !!data.catalogBookId || (!!data.title && !!data.author), { message: "کتاب یا عنوان و نویسنده لازم است" });

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

    const [catalog] = data.catalogBookId ? await db.select({ id: CatalogBook.id, title: CatalogBook.title, author: CatalogBook.author, genre: CatalogBook.genre })
      .from(CatalogBook).where(and(eq(CatalogBook.id, data.catalogBookId), eq(CatalogBook.status, "APPROVED"))).limit(1) : [];
    if (data.catalogBookId && !catalog) return NextResponse.json({ error: "کتاب کاتالوگ پیدا نشد" }, { status: 404 });
    if (catalog) {
      const [existing] = await db.select({ id: Wishlist.id }).from(Wishlist).where(and(eq(Wishlist.userId, user.id), eq(Wishlist.catalogBookId, catalog.id))).limit(1);
      if (existing) return NextResponse.json({ error: "این کتاب از قبل در لیست خرید است" }, { status: 409 });
    }
    const [newWishlist] = await db
      .insert(Wishlist)
      .values({
        userId: user.id,
        title: catalog?.title ?? data.title!,
        author: catalog?.author ?? data.author!,
        catalogBookId: catalog?.id ?? null,
        publisher: data.publisher || null,
        genre: data.genre || catalog?.genre || null,
        translator: data.translator || null,
        note: data.note || null,
        priority: data.priority,
      })
      .returning();

    return NextResponse.json(
      { wishlist: newWishlist, message: "کتاب به لیست خرید اضافه شد" },
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
        orderBy = sortOrder === "asc"
          ? asc(sql`case ${Wishlist.priority} when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`)
          : desc(sql`case ${Wishlist.priority} when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`);
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
      .select({
        item: Wishlist,
        catalogCover: CatalogBook.coverImage,
        editionCover: BookEdition.coverImage,
      })
      .from(Wishlist)
      .leftJoin(CatalogBook, eq(Wishlist.catalogBookId, CatalogBook.id))
      .leftJoin(BookEdition, eq(CatalogBook.primaryEditionId, BookEdition.id))
      .where(eq(Wishlist.userId, user.id))
      .orderBy(orderBy);

    const response = NextResponse.json({
      wishlist: userWishlist.map(({ item, catalogCover, editionCover }) => ({
        ...item,
        coverImage: editionCover ?? catalogCover,
      })),
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
