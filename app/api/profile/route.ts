import { readJsonBody } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import {
  updateProfileSchema,
  updateProfileVisibilitySchema,
} from "@/lib/validations/profile";
import {
  getMyProfile,
  updateProfile,
  updateProfileVisibility,
  ProfileError,
} from "@/lib/profile/service";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  const profile = await getMyProfile(user.id);
  if (!profile) return apiError("کاربر یافت نشد", 404);
  return apiSuccess({ profile }, { headers: noStoreHeaders });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const profile = await updateProfile(user.id, parsed.data);
    return apiSuccess(
      { profile, message: "پروفایل به‌روزرسانی شد" },
      { headers: noStoreHeaders }
    );
  } catch (err) {
    if (err instanceof ProfileError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ profile update error:", err);
    return apiError("خطا در به‌روزرسانی پروفایل", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("احراز هویت نشده", 401, "UNAUTHENTICATED");

  let body: unknown;
  try {
    body = await readJsonBody(req, 1_048_576);
  } catch {
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = updateProfileVisibilitySchema.safeParse(body);
  if (!parsed.success) return apiError("مقدار نمایش پروفایل نامعتبر است", 422);

  try {
    const profile = await updateProfileVisibility(user.id, parsed.data.visibility);
    return apiSuccess(
      { profile, message: "حریم خصوصی پروفایل ذخیره شد" },
      { headers: noStoreHeaders }
    );
  } catch (err) {
    if (err instanceof ProfileError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ profile visibility update error:", err);
    return apiError("خطا در ذخیره حریم خصوصی پروفایل", 500);
  }
}
