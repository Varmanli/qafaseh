import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { heroActiveSchema, heroSlideInputSchema } from "@/lib/validations/home";
import {
  adminDeleteHeroSlide,
  adminSetHeroSlideActive,
  adminUpdateHeroSlide,
} from "@/lib/home/service";

async function handlePATCH(
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

  // اگر فقط isActive ارسال شده باشد، فقط وضعیت را تغییر می‌دهیم؛ وگرنه ویرایش کامل.
  if (
    body &&
    typeof body === "object" &&
    !("title" in body) &&
    "isActive" in body
  ) {
    const parsed = heroActiveSchema.safeParse(body);
    if (!parsed.success) return apiError("ورودی نامعتبر است", 422);
    await adminSetHeroSlideActive(id, parsed.data.isActive);
    return apiSuccess({ message: "به‌روزرسانی شد" });
  }

  const parsed = heroSlideInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }
  await adminUpdateHeroSlide(id, parsed.data);
  return apiSuccess({ message: "ذخیره شد" });
}

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const { id } = await params;
  await adminDeleteHeroSlide(id);
  return apiSuccess({ message: "حذف شد" });
}

export const PATCH = withPublicContentInvalidation(handlePATCH);

export const DELETE = withPublicContentInvalidation(handleDELETE);
