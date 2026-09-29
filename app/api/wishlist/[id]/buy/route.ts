import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { Book, Wishlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { addBookToLibrary } from "@/lib/book/detail-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const parsed = z.object({ addToLibrary: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 422 });
  const { id } = await params;
  try {
    const [item] = await db.select().from(Wishlist).where(and(eq(Wishlist.id, id), eq(Wishlist.userId, user.id))).limit(1);
    if (!item) return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
    let bookId: string | null = null;
    if (parsed.data.addToLibrary) {
      if (item.catalogBookId) {
        const result = await addBookToLibrary(user.id, item.catalogBookId, "UNREAD");
        if (!result.ok) return NextResponse.json({ error: "افزودن به کتابخانه ناموفق بود" }, { status: 422 });
        bookId = result.bookId;
      } else {
        const [book] = await db.insert(Book).values({
          userId: user.id, title: item.title, author: item.author, translator: item.translator,
          publisher: item.publisher, genre: item.genre || "نامشخص", format: "PHYSICAL", status: "UNREAD",
        }).returning({ id: Book.id });
        bookId = book.id;
      }
    }
    await db.delete(Wishlist).where(and(eq(Wishlist.id, id), eq(Wishlist.userId, user.id)));
    return NextResponse.json({ bookId, message: "خرید ثبت شد" });
  } catch (error) {
    console.error("Wishlist purchase failed", error);
    return NextResponse.json({ error: "ثبت خرید ناموفق بود" }, { status: 500 });
  }
}
