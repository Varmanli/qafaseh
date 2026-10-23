import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { heroSlideInputSchema } from "@/lib/validations/home";
import {
  adminCreateHeroSlide,
  adminListHeroSlides,
} from "@/lib/home/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  const slides = await adminListHeroSlides();
  return apiSuccess({ slides });
}

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");
  if (!isAdmin(user)) return apiError("دسترسی غیرمجاز", 403, "FORBIDDEN");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }
  const parsed = heroSlideInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  const id = await adminCreateHeroSlide(parsed.data);
  return apiSuccess({ id, message: "اسلاید ساخته شد" }, { status: 201 });
}

export const POST = withPublicContentInvalidation(handlePOST);
