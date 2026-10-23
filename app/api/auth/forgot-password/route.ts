import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/auth/service";
import { getPublicAppOrigin } from "@/lib/auth/redirects";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await sharedRateLimit(getClientKey(req, "forgot"), {
    limit: 3,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return apiError(
      "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
      429,
      "RATE_LIMITED"
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof RequestError) return apiError(error.message, error.status);
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ایمیل نامعتبر است", 422);
  }

  // پیام عمومی همیشه یکسان است تا وجود/نبود ایمیل لو نرود
  const genericMessage =
    "اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی برای آن ارسال شد.";

  try {
    const emailLimit = await sharedRateLimit(`forgot-email:${parsed.data.email.trim().toLowerCase()}`, {
      limit: 3, windowMs: 15 * 60_000,
    });
    if (!emailLimit.allowed) return apiSuccess({ message: genericMessage });
    const { devResetUrl } = await requestPasswordReset(
      parsed.data.email,
      getPublicAppOrigin()
    );
    return apiSuccess({
      message: genericMessage,
      ...(devResetUrl ? { devResetUrl } : {}),
    });
  } catch (err) {
    console.error("❌ forgot-password error:", err);
    // باز هم پیام عمومی برمی‌گردانیم تا اطلاعات لو نرود
    return apiSuccess({ message: genericMessage });
  }
}
