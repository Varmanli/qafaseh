import { readJsonBody, RequestError } from "@/lib/api/request";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { loginSchema } from "@/lib/validations/auth";
import { AuthError, authenticateUser } from "@/lib/auth/service";
import { signJwt } from "@/lib/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await sharedRateLimit(getClientKey(req, "login"), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return apiError(
      "تلاش‌های ناموفق زیاد بود. کمی بعد دوباره تلاش کنید.",
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "ایمیل، نام کاربری یا رمز عبور اشتباه است",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  try {
    const accountLimit = await sharedRateLimit(`login-account:${parsed.data.identifier.trim().toLowerCase()}`, {
      limit: 20, windowMs: 15 * 60_000,
    });
    if (!accountLimit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const user = await authenticateUser(parsed.data);
    // Sign the version whose password was checked, even if a reset races login.
    const token = signJwt({ id: user.id, sessionVersion: user.sessionVersion! });

    const res = apiSuccess({ message: "ورود موفق", user });
    setAuthCookie(res, token, parsed.data.rememberMe);
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(err.message, err.status, err.code);
    }
    console.error("❌ login error:", err);
    return apiError("خطای سرور. بعداً دوباره تلاش کنید.", 500);
  }
}
