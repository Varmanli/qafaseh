import { withPublicContentInvalidation } from "@/lib/cache/public-data";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { heroReorderSchema } from "@/lib/validations/home";
import { adminReorderHeroSlides } from "@/lib/home/service";

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
  const parsed = heroReorderSchema.safeParse(body);
  if (!parsed.success) return apiError("ورودی نامعتبر است", 422);

  await adminReorderHeroSlides(parsed.data.orderedIds);
  return apiSuccess({ message: "ترتیب ذخیره شد" });
}

export const POST = withPublicContentInvalidation(handlePOST);
