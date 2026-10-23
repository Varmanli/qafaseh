import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { updateNoteSchema } from "@/lib/validations/notes";
import {
  deletePublishedNote,
  updatePublishedNote,
  NoteError,
} from "@/lib/notes/service";

// PUT: edit one of the user's own published notes.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  const { id } = await params;

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const note = await updatePublishedNote(user.id, id, parsed.data.content);
    return apiSuccess({ note, message: "یادداشت بروزرسانی شد" });
  } catch (err) {
    if (err instanceof NoteError) return apiError(err.message, err.status, err.code);
    console.error("❌ note update error:", err);
    return apiError("خطا در بروزرسانی یادداشت", 500);
  }
}

// DELETE: remove one of the user's own published notes.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  const { id } = await params;

  try {
    await deletePublishedNote(user.id, id);
    return apiSuccess({ message: "یادداشت حذف شد" });
  } catch (err) {
    if (err instanceof NoteError) return apiError(err.message, err.status, err.code);
    console.error("❌ note delete error:", err);
    return apiError("خطا در حذف یادداشت", 500);
  }
}
