import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { Wishlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const wishlistUpdateSchema = z.object({
  title: z.string().trim().min(1, "عنوان کتاب نمی‌تواند خالی باشد").max(255).optional(),
  author: z.string().trim().min(1, "نام نویسنده نمی‌تواند خالی باشد").max(255).optional(),
  publisher: z.string().trim().max(255).nullish(),
  genre: z.string().trim().max(100).nullish(),
  translator: z.string().trim().max(255).nullish(),
  note: z.string().trim().max(1000).nullish(),
  priority: z
    .enum([
      "MUST_HAVE",
      "WANT_IT",
      "NICE_TO_HAVE",
      "IF_EXTRA_MONEY",
      "NOT_IMPORTANT",
    ])
    .optional(),
});

// 📌 حذف آیتم خاص (فقط برای مالک)
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
      return NextResponse.json(
        { error: "شناسه آیتم نامعتبر است" },
        { status: 400 }
      );
    }

    const [deletedItem] = await db
      .delete(Wishlist)
      .where(and(eq(Wishlist.id, id), eq(Wishlist.userId, user.id)))
      .returning();

    if (!deletedItem) {
      return NextResponse.json(
        { error: "آیتم پیدا نشد یا متعلق به شما نیست" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "آیتم حذف شد",
      item: deletedItem,
    });
  } catch (err) {
    console.error("❌ خطا در حذف آیتم:", err);
    return NextResponse.json({ error: "خطا در حذف آیتم" }, { status: 500 });
  }
}

// 📌 ویرایش آیتم خاص (فقط برای مالک)
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
      return NextResponse.json(
        { error: "شناسه آیتم نامعتبر است" },
        { status: 400 }
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

    const parsed = wishlistUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "داده‌های نامعتبر" },
        { status: 422 }
      );
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "هیچ داده‌ای برای ویرایش ارسال نشده" },
        { status: 400 }
      );
    }

    const updateData: Partial<typeof Wishlist.$inferInsert> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.author !== undefined) updateData.author = data.author;
    if (data.publisher !== undefined) updateData.publisher = data.publisher || null;
    if (data.genre !== undefined) updateData.genre = data.genre || null;
    if (data.translator !== undefined) updateData.translator = data.translator || null;
    if (data.note !== undefined) updateData.note = data.note || null;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const [updatedItem] = await db
      .update(Wishlist)
      .set(updateData)
      .where(and(eq(Wishlist.id, id), eq(Wishlist.userId, user.id)))
      .returning();

    if (!updatedItem) {
      return NextResponse.json(
        { error: "آیتم پیدا نشد یا متعلق به شما نیست" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      item: updatedItem,
      message: "آیتم ویرایش شد",
    });
  } catch (err) {
    console.error("❌ خطا در ویرایش آیتم:", err);
    return NextResponse.json({ error: "خطا در ویرایش آیتم" }, { status: 500 });
  }
}
