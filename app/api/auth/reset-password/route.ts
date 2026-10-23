import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { resetPasswordApiSchema } from "@/lib/validations/auth";
import { AuthError, resetPassword } from "@/lib/auth/service";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await sharedRateLimit(getClientKey(req, "reset"), {
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

  const parsed = resetPasswordApiSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است", 422);
  }

  try {
    await resetPassword(parsed.data);
    return apiSuccess({
      message: "رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ reset-password error:", err);
    return apiError("خطای سرور. بعداً دوباره تلاش کنید.", 500);
  }
}
