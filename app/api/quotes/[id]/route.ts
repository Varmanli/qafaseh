import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { Quote } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import {
  isOwnedQuoteImageKey,
  normalizeQuoteImageKey,
  normalizeQuoteText,
} from "@/lib/quotes/image";
import { normalizeQuoteBackground } from "@/lib/quotes/backgrounds";
import { getVisibleQuoteById } from "@/lib/quotes/service";
import { deleteImageUpload } from "@/lib/server/upload-storage";

async function manageableQuote(id: string, userId: string, admin: boolean) {
  const [row] = await db
    .select({ quote: Quote, ownerId: Quote.userId })
    .from(Quote)
    .where(eq(Quote.id, id));
  if (!row) return { error: "تکه پیدا نشد", status: 404 } as const;
  if (!admin && row.ownerId !== userId) return { error: "دسترسی غیرمجاز", status: 403 } as const;
  return row;
}

async function cleanupImage(key: string | null, userId: string) {
  if (!key || !isOwnedQuoteImageKey(key, userId)) return;
  try {
    await deleteImageUpload(key);
  } catch (error) {
    console.error("[quotes] image cleanup failed", { key, error });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const quote = await getVisibleQuoteById(id, viewer?.id);
  const headers = { "Cache-Control": "private, no-store" };
  if (!quote) return NextResponse.json({ error: "تکه پیدا نشد" }, { status: 404, headers });
  return NextResponse.json({ quote }, { headers });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    const { id } = await params;
    const existing = await manageableQuote(id, user.id, isAdmin(user));
    if ("error" in existing) return NextResponse.json({ error: existing.error }, { status: existing.status });

    const body = (await req.json()) as Record<string, unknown>;
    const content = normalizeQuoteText(body.content);
    // An omitted imageKey means "keep the current image". Removal must be
    // explicit (`imageKey: null`) so partial clients cannot discard media.
    const imageKey = Object.prototype.hasOwnProperty.call(body, "imageKey")
      ? normalizeQuoteImageKey(body.imageKey)
      : existing.quote.imageKey;
    const background = Object.prototype.hasOwnProperty.call(body, "background")
      ? normalizeQuoteBackground(body.background)
      : existing.quote.background;
    const page = typeof body.page === "number" && Number.isInteger(body.page) && body.page > 0
      ? body.page
      : null;

    if (!content && !imageKey) {
      return NextResponse.json({ error: "حذف تنها محتوای تکه مجاز نیست" }, { status: 422 });
    }
    if (imageKey && !isOwnedQuoteImageKey(imageKey, user.id) && !isOwnedQuoteImageKey(imageKey, existing.ownerId)) {
      return NextResponse.json({ error: "تصویر انتخاب‌شده معتبر نیست" }, { status: 403 });
    }
    if (imageKey && imageKey !== existing.quote.imageKey) {
      const [alreadyAttached] = await db
        .select({ id: Quote.id })
        .from(Quote)
        .where(eq(Quote.imageKey, imageKey))
        .limit(1);
      if (alreadyAttached) {
        return NextResponse.json({ error: "این تصویر قبلاً به تکه دیگری متصل شده است" }, { status: 409 });
      }
    }

    const [quote] = await db
      .update(Quote)
      .set({ content, imageKey, page, background, updatedAt: new Date() })
      .where(eq(Quote.id, id))
      .returning();
    if (existing.quote.imageKey && existing.quote.imageKey !== imageKey) {
      await cleanupImage(existing.quote.imageKey, existing.ownerId);
    }
    return NextResponse.json({ quote, message: "تکه با موفقیت بروزرسانی شد" });
  } catch (error) {
    console.error("❌ خطا در بروزرسانی تکه:", error);
    return NextResponse.json({ error: "خطا در بروزرسانی تکه" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
    const { id } = await params;
    const existing = await manageableQuote(id, user.id, isAdmin(user));
    if ("error" in existing) return NextResponse.json({ error: existing.error }, { status: existing.status });

    await db.delete(Quote).where(eq(Quote.id, id));
    await cleanupImage(existing.quote.imageKey, existing.ownerId);
    return NextResponse.json({ message: "تکه با موفقیت حذف شد" });
  } catch (error) {
    console.error("❌ خطا در حذف تکه:", error);
    return NextResponse.json({ error: "خطا در حذف تکه" }, { status: 500 });
  }
}
