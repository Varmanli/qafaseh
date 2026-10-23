import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, RequestError } from "@/lib/api/request";
import { getClientKey, sharedRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/auth/service";
import { startPhoneSignup } from "@/lib/auth/phone-signup";

export async function POST(request: NextRequest) {
  try {
    const limit = await sharedRateLimit(getClientKey(request, "signup-phone"), { limit: 10, windowMs: 10 * 60_000 });
    if (!limit.allowed) return apiError("کمی بعد دوباره تلاش کنید", 429, "RATE_LIMITED");
    return apiSuccess(await startPhoneSignup(await readJsonBody(request, 4096)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError || error instanceof RequestError) return apiError(error.message, error.status, error instanceof AuthError ? error.code : undefined);
    console.error("[signup] phone step failed");
    return apiError("بررسی شماره ممکن نشد؛ دوباره تلاش کنید", 500);
  }
}
