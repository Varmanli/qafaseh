import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { registerApiSchema } from "@/lib/validations/auth";
import { AuthError, registerUser } from "@/lib/auth/service";
import { issueVerificationCode } from "@/lib/auth/verification-codes";
import { isEmailOtpEnabled } from "@/lib/auth/email-otp";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await sharedRateLimit(getClientKey(req, "register"), {
    limit: 5,
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

  const parsed = registerApiSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    const user = await registerUser(parsed.data);
    const emailOtpEnabled = isEmailOtpEnabled();
    let codeResult: { devCode?: string } = {};
    let verificationDeliveryFailed = false;
    if (emailOtpEnabled) {
      try {
        codeResult = await issueVerificationCode({
          email: parsed.data.email,
          purpose: "email_verification",
        });
      } catch (error) {
        if (!(error instanceof AuthError) || error.code !== "EMAIL_DELIVERY_FAILED") throw error;
        verificationDeliveryFailed = true;
      }
    }
    return apiSuccess(
      {
        message: "ثبت‌نام با موفقیت انجام شد",
        user,
        requiresEmailVerification: emailOtpEnabled,
        verificationDeliveryFailed,
        ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ register error:", err);
    return apiError("خطای سرور. بعداً دوباره تلاش کنید.", 500);
  }
}
