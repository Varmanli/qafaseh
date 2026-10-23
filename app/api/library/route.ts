import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { addToLibrarySchema } from "@/lib/validations/catalog";
import { addEditionToLibrary, CatalogError } from "@/lib/catalog/service";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = addToLibrarySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const book = await addEditionToLibrary(user.id, parsed.data);
    return apiSuccess(
      { book, message: "کتاب به کتابخانه‌ی شما اضافه شد" },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof CatalogError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ library add error:", err);
    return apiError("خطا در افزودن به کتابخانه", 500);
  }
}
