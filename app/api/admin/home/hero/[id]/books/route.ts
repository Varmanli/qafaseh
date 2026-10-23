import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { heroBooksSchema } from "@/lib/validations/home";
import { adminSetHeroSlideBooks } from "@/lib/home/service";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }
  const parsed = heroBooksSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    await adminSetHeroSlideBooks(id, parsed.data.bookIds);
  } catch {
    return apiError("ذخیره‌ی کتاب‌ها ناموفق بود", 400);
  }
  return apiSuccess({ message: "کتاب‌های اسلاید ذخیره شد" });
}

export const POST = withPublicContentInvalidation(handlePOST);
