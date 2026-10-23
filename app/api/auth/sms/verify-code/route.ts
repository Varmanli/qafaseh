import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, RequestError } from "@/lib/api/request";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";
import { isSmsOtpEnabled, isSignupOtpEnabled, smsVerifySchema } from "@/lib/auth/phone";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/service";
import { verifySmsOtp } from "@/lib/auth/sms-otp";
import { setAuthCookie } from "@/lib/auth/cookies";
import { signJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  if (!isSmsOtpEnabled()) return apiError("ورود پیامکی فعال نیست", 503, "SMS_OTP_DISABLED");
  try {
    const limit = await sharedRateLimit(getClientKey(request, "sms-verify"), { limit: 30, windowMs: 60_000 });
    if (!limit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const input = smsVerifySchema.safeParse(await readJsonBody(request, 4096));
    if (!input.success) return apiError(input.error.issues[0]?.message ?? "شماره یا کد نامعتبر است", 422);
    if (input.data.purpose === "signup" && !isSignupOtpEnabled()) return apiError("ثبت‌نام پیامکی فعلاً غیرفعال است", 403, "SIGNUP_OTP_DISABLED");
    const current = input.data.purpose === "link" ? await getCurrentUser() : null;
    if (input.data.purpose === "link" && !current) return apiError("ابتدا وارد شوید", 401, "UNAUTHENTICATED");
    const user = await verifySmsOtp(input.data.phone, input.data.code, input.data.purpose, current?.id, current?.sessionVersion, input.data.name, input.data.password);
    if (input.data.purpose === "recovery") {
      if (!("resetToken" in user)) throw new AuthError("کد بازیابی نامعتبر است", 400, "INVALID_CODE");
      return apiSuccess({ resetToken: user.resetToken, message: "شماره تأیید شد؛ رمز جدید را انتخاب کنید" });
    }
    const response = apiSuccess({ user, message: input.data.purpose === "link" ? "شماره به حساب شما متصل شد" : "ورود موفق" });
    setAuthCookie(response, signJwt({ id: user.id, sessionVersion: user.sessionVersion }), input.data.rememberMe);
    return response;
  } catch (error) {
    if (error instanceof AuthError || error instanceof RequestError) return apiError(error.message, error.status, error instanceof AuthError ? error.code : undefined);
    console.error("[sms-otp] verification failed");
    return apiError("تأیید کد ممکن نشد", 500);
  }
}
