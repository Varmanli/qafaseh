import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, RequestError } from "@/lib/api/request";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";
import { isSmsOtpEnabled, smsRequestSchema } from "@/lib/auth/phone";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/service";
import { issueSmsOtp } from "@/lib/auth/sms-otp";

export async function POST(request: NextRequest) {
  if (!isSmsOtpEnabled()) return apiError("ورود پیامکی فعال نیست", 503, "SMS_OTP_DISABLED");
  try {
    const ip = await sharedRateLimit(getClientKey(request, "sms-send"), { limit: 10, windowMs: 10 * 60_000 });
    if (!ip.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const input = smsRequestSchema.safeParse(await readJsonBody(request, 4096));
    if (!input.success) return apiError(input.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
    const user = input.data.purpose === "link" ? await getCurrentUser() : null;
    if (input.data.purpose === "link" && !user) return apiError("ابتدا وارد شوید", 401, "UNAUTHENTICATED");
    const phone = await sharedRateLimit(`sms-phone:${input.data.phone}`, { limit: 3, windowMs: 15 * 60_000 });
    if (!phone.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const configuredBudget = Number(process.env.SMS_DAILY_SEND_LIMIT ?? 500);
    const dailyBudget = Number.isSafeInteger(configuredBudget) && configuredBudget >= 1 && configuredBudget <= 100_000 ? configuredBudget : 500;
    const budget = await sharedRateLimit("sms-daily-budget", { limit: dailyBudget, windowMs: 24 * 60 * 60_000 });
    if (!budget.allowed) return apiError("ارسال پیامک موقتاً در دسترس نیست", 503, "SMS_BUDGET_EXCEEDED");
    const result = await issueSmsOtp(input.data.phone, input.data.purpose, user?.id);
    return apiSuccess({ message: input.data.purpose === "recovery" ? "اگر شماره به حساب متصل باشد، کد بازیابی ارسال می‌شود" : "کد ارسال شد", ...result });
  } catch (error) {
    if (error instanceof AuthError || error instanceof RequestError) return apiError(error.message, error.status, error instanceof AuthError ? error.code : undefined);
    console.error("[sms-otp] request failed");
    return apiError("ارسال پیامک ممکن نشد", 503);
  }
}
