import { readJsonBody } from "@/lib/api/request";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { assertOwnedBook, getOwnedPersonalBookNote } from "@/lib/reading-notes/service";
import {
  publishPersonalBookThought,
  unpublishPersonalBookThought,
} from "@/lib/public-thoughts/service";

const shareThoughtSchema = z.object({
  content: z.string().trim().min(1, "متن لحظه را بنویسید").max(3000, "متن نمی‌تواند بیشتر از ۳۰۰۰ نویسه باشد"),
  pageNumber: z.number().int().min(1).nullable(),
  type: z.enum(["THOUGHT", "QUOTE", "REFLECTION"]).default("THOUGHT"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { id } = await params;
  const source = await getOwnedPersonalBookNote(id, user.id);
  if (!source) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });

  const parsed = shareThoughtSchema.safeParse(await readJsonBody(request, 1_048_576));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });

  const book = await assertOwnedBook(source.bookId, user.id);
  if (parsed.data.pageNumber && book?.pageCount && parsed.data.pageNumber > book.pageCount) {
    return NextResponse.json({ error: `شماره صفحه نمی‌تواند بیشتر از ${book.pageCount} باشد` }, { status: 422 });
  }

  const thought = await publishPersonalBookThought({ noteId: id, userId: user.id, ...parsed.data });
  if (!thought) return NextResponse.json({ error: "این کتاب برای اشتراک‌گذاری عمومی آماده نیست" }, { status: 422 });

  return NextResponse.json({ thought, message: "لحظه در صفحه عمومی کتاب منتشر شد" }, { status: 201 });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { id } = await params;
  if (!await unpublishPersonalBookThought(id, user.id)) {
    return NextResponse.json({ error: "لحظه‌ی منتشرشده پیدا نشد" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message: "لحظه از صفحه عمومی برداشته شد" });
}
