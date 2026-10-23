import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { addToLibraryFromBookSchema } from "@/lib/validations/notes";
import { addBookToLibrary } from "@/lib/book/detail-service";

// POST: add the book at /book/[id] to the current user's library (by copying it).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    /* empty body → default status */
  }

  const parsed = addToLibraryFromBookSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  const result = await addBookToLibrary(
    user.id,
    id,
    parsed.data.status,
    parsed.data.editionId,
  );
  if (!result.ok) {
    return apiError(
      result.reason === "EDITION_NOT_FOUND" ? "نسخه پیدا نشد" : "کتاب پیدا نشد",
      404,
      result.reason === "EDITION_NOT_FOUND" ? "EDITION_NOT_FOUND" : "BOOK_NOT_FOUND",
    );
  }

  return apiSuccess({
    bookId: result.bookId,
    already: result.already,
    message: result.already
      ? "این کتاب از قبل در کتابخانه‌ی توست"
      : "کتاب به کتابخانه‌ات اضافه شد",
  });
}
