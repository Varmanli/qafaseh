import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { setAuthCookie } from "@/lib/auth/cookies";
import { AuthError } from "@/lib/auth/service";
import { signJwt } from "@/lib/jwt";
import { isEmailOtpEnabled } from "@/lib/auth/email-otp";
import { verifyVerificationCode } from "@/lib/auth/verification-codes";
import { verifyCodeSchema } from "@/lib/validations/auth";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await sharedRateLimit(getClientKey(req, "verify-code"), { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof RequestError) return apiError(error.message, error.status);
    return apiError("درخواست نامعتبر است", 400);
  }

  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "کد تایید نامعتبر است.",
      422
    );
  }

  if (!isEmailOtpEnabled()) {
    return apiError("تایید کد ایمیل موقتاً غیرفعال است.", 503, "EMAIL_OTP_DISABLED");
  }

  try {
    const result = await verifyVerificationCode(parsed.data);

    if (parsed.data.purpose === "login" && result.status === "verified" && result.userId && result.sessionVersion !== undefined) {
      const token = signJwt({ id: result.userId, sessionVersion: result.sessionVersion });
      const response = apiSuccess({ message: "ورود با موفقیت انجام شد." });
      setAuthCookie(response, token, true);
      return response;
    }

    if (parsed.data.purpose === "email_verification") {
      return apiSuccess({ message: "ایمیل شما با موفقیت تایید شد." });
    }

    return apiSuccess({
      message: "کد تایید شد.",
      ...(result.status === "verified" && result.resetToken
        ? { resetToken: result.resetToken }
        : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.status, error.code);
    }

    console.error("❌ verify-code error:", error);
    return apiError("خطای سرور. بعداً دوباره تلاش کنید.", 500);
  }
}
