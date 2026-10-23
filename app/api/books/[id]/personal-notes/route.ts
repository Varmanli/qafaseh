import { readJsonBody } from "@/lib/api/request";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { personalBookNoteSchema } from "@/lib/validations/personal-book-notes";
import { assertOwnedBook, createPersonalBookNote, getPersonalBookNotes } from "@/lib/reading-notes/service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const { id } = await params;
  if (!await assertOwnedBook(id, user.id)) return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
  return NextResponse.json({ notes: await getPersonalBookNotes(id, user.id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  const { id } = await params;
  const book = await assertOwnedBook(id, user.id);
  if (!book) return NextResponse.json({ error: "کتاب پیدا نشد" }, { status: 404 });
  const parsed = personalBookNoteSchema.safeParse(await readJsonBody(request, 1_048_576));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" }, { status: 422 });
  const pageNumber = parsed.data.pageNumber ?? null;
  if (pageNumber && book.pageCount && pageNumber > book.pageCount) return NextResponse.json({ error: `شماره صفحه نمی‌تواند بیشتر از ${book.pageCount} باشد` }, { status: 422 });
  const note = await createPersonalBookNote({ bookId: id, userId: user.id, content: parsed.data.content, pageNumber });
  return NextResponse.json({ note }, { status: 201 });
}
