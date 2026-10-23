import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { AuthError } from "@/lib/auth/service";
import { isEmailOtpEnabled } from "@/lib/auth/email-otp";
import { issueVerificationCode, normalizeEmail } from "@/lib/auth/verification-codes";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";
import { requestCodeSchema } from "@/lib/validations/auth";
import { isEmailDeliveryConfigured } from "@/lib/email";

export async function POST(req: NextRequest) {
  const ipLimit = await sharedRateLimit(getClientKey(req, "request-code"), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!ipLimit.allowed) {
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

  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "لطفاً یک ایمیل معتبر وارد کنید.",
      422
    );
  }

  if (!isEmailOtpEnabled()) {
    return apiError("ارسال کد ایمیل موقتاً غیرفعال است.", 503, "EMAIL_OTP_DISABLED");
  }
  if (!isEmailDeliveryConfigured()) return apiError("ارسال ایمیل پیکربندی نشده است", 503, "EMAIL_DELIVERY_FAILED");

  const emailRateLimit = await sharedRateLimit(
    `request-code:${parsed.data.purpose}:${normalizeEmail(parsed.data.email)}`,
    { limit: 3, windowMs: 60_000 }
  );
  if (!emailRateLimit.allowed) {
    return apiError(
      "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
      429,
      "RATE_LIMITED"
    );
  }

  const genericMessage = "اگر ایمیل معتبر باشد، کد تایید ارسال شد.";

  try {
    const result = await issueVerificationCode({
      email: parsed.data.email,
      purpose: parsed.data.purpose,
      requireExistingUser: parsed.data.purpose !== "email_verification",
      requireVerifiedUser: false,
    });

    return apiSuccess({
      message: genericMessage,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.status, error.code);
    }

    console.error("❌ request-code error:", error);
    return apiError("ارسال کد ممکن نشد؛ کمی بعد دوباره تلاش کنید", 503, "EMAIL_DELIVERY_FAILED");
  }
}
