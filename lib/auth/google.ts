import crypto from "crypto";
import { AuthError } from "@/lib/auth/service";
import { getPublicAppOrigin } from "@/lib/auth/redirects";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("[auth] GOOGLE_CLIENT_ID تنظیم نشده است.");
  }
  return clientId;
}

function getGoogleClientSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("[auth] GOOGLE_CLIENT_SECRET تنظیم نشده است.");
  }
  return secret;
}

export function getGoogleRedirectUri() {
  const configuredUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configuredUri) return configuredUri;
  return `${getPublicAppOrigin()}/api/auth/google/callback`;
}

export function isGoogleOAuthDebugEnabled() {
  return process.env.GOOGLE_OAUTH_DEBUG === "true";
}

export function redactGoogleAuthorizationUrl(url: string) {
  const safeUrl = new URL(url);
  safeUrl.searchParams.set("state", "[redacted]");
  return safeUrl.toString();
}

export function createGoogleState() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildGoogleAuthUrl(input: { state: string }) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    access_type: "offline",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(input: { code: string }) {
  const body = new URLSearchParams({
    code: input.code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenRes.ok) {
    throw new AuthError("ورود با گوگل ناموفق بود.", 400, "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (
    !tokenData.access_token ||
    tokenData.token_type?.toLowerCase() !== "bearer" ||
    typeof tokenData.expires_in !== "number" ||
    !Number.isFinite(tokenData.expires_in) ||
    tokenData.expires_in <= 0
  ) {
    throw new AuthError("ورود با گوگل ناموفق بود.", 400, "GOOGLE_TOKEN_MISSING");
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!profileRes.ok) {
    throw new AuthError("دریافت اطلاعات حساب گوگل ناموفق بود.", 400, "GOOGLE_PROFILE_FAILED");
  }

  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email || !profile.email_verified) {
    throw new AuthError(
      "ایمیل حساب گوگل تایید نشده است.",
      400,
      "GOOGLE_EMAIL_NOT_VERIFIED"
    );
  }

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    image: profile.picture ?? null,
  };
}
