import { readJsonBody } from "@/lib/api/request";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { personalBookNoteSchema } from "@/lib/validations/personal-book-notes";
import { assertOwnedBook, deletePersonalBookNote, getOwnedPersonalBookNote, updatePersonalBookNote } from "@/lib/reading-notes/service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const parsed = personalBookNoteSchema.safeParse(await readJsonBody(request, 1_048_576));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });
  const { id } = await params;
  const existing = await getOwnedPersonalBookNote(id, user.id);
  if (!existing) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
  const book = await assertOwnedBook(existing.bookId, user.id);
  const pageNumber = parsed.data.pageNumber ?? null;
  if (pageNumber && book?.pageCount && pageNumber > book.pageCount) return NextResponse.json({ error: `شماره صفحه نمی‌تواند بیشتر از ${book.pageCount} باشد` }, { status: 422 });
  const note = await updatePersonalBookNote(id, user.id, { content: parsed.data.content, pageNumber });
  if (!note) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const { id } = await params;
  if (!await deletePersonalBookNote(id, user.id)) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
