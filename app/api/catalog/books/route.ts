import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { manualBookSchema } from "@/lib/validations/catalog";
import { createManualBook, CatalogError } from "@/lib/catalog/service";

// ساخت دستی کتاب: کتاب کانونی + نسخه + افزودن به کتابخانه‌ی کاربر
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = manualBookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const book = await createManualBook(user.id, parsed.data);
    return apiSuccess(
      {
        book,
        message:
          "کتاب به قفسه‌ی شما اضافه شد و برای نمایش در کاتالوگ عمومی در انتظار تأیید مدیر است.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof CatalogError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ manual book create error:", err);
    return apiError("خطا در ساخت کتاب", 500);
  }
}
