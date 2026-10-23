import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, RequestError } from "@/lib/api/request";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/auth/service";
import { registerPhoneUser } from "@/lib/auth/phone-signup";
import { phoneSignupSchema } from "@/lib/auth/phone";
import { setAuthCookie } from "@/lib/auth/cookies";
import { signJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const limit = await sharedRateLimit(getClientKey(request, "signup"), { limit: 5, windowMs: 10 * 60_000 });
    if (!limit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const parsed = phoneSignupSchema.safeParse(await readJsonBody(request, 4096));
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 422, "INVALID_INPUT");
    const phoneLimit = await sharedRateLimit(`signup-phone:${parsed.data.phone}`, { limit: 5, windowMs: 15 * 60_000 });
    if (!phoneLimit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    const user = await registerPhoneUser(parsed.data);
    const response = apiSuccess({ user, message: "حساب شما ساخته شد" }, { status: 201 });
    setAuthCookie(response, signJwt({ id: user.id, sessionVersion: user.sessionVersion }), true);
    return response;
  } catch (error) {
    if (error instanceof AuthError || error instanceof RequestError) return apiError(error.message, error.status, error instanceof AuthError ? error.code : undefined);
    console.error("[signup] registration failed");
    return apiError("ساخت حساب ممکن نشد؛ دوباره تلاش کنید", 500);
  }
}
