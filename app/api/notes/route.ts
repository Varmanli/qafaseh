import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { createNoteSchema } from "@/lib/validations/notes";
import { createPublishedNote, NoteError } from "@/lib/notes/service";

// POST: publish a public note for a book the user owns.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const note = await createPublishedNote(
      user.id,
      {
        catalogBookId: parsed.data.catalogBookId,
        bookEditionId: parsed.data.bookEditionId ?? null,
        scope: parsed.data.scope,
        content: parsed.data.content,
      }
    );
    return apiSuccess({ note, message: "یادداشت منتشر شد" }, { status: 201 });
  } catch (err) {
    if (err instanceof NoteError) return apiError(err.message, err.status, err.code);
    console.error("❌ note create error:", err);
    return apiError("خطا در انتشار یادداشت", 500);
  }
}
