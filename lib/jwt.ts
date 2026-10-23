import jwt, { SignOptions } from "jsonwebtoken";
import { TOKEN_TTL_SECONDS } from "@/lib/auth/constants";

/**
 * Reads the JWT secret lazily so that a missing env var produces a clear,
 * developer-friendly error *when auth is actually used* instead of crashing
 * the whole app at import/build time.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32 || secret === "change-me-to-a-long-random-secret-value") {
    throw new Error(
      "[auth] متغیر محیطی JWT_SECRET تنظیم نشده یا خیلی کوتاه است. " +
        "یک مقدار تصادفی و امن (حداقل ۳۲ کاراکتر) در فایل .env قرار دهید. " +
        "نمونه را در .env.example ببینید."
    );
  }

  return secret;
}

export interface AuthTokenPayload {
  /** شناسه کاربر */
  id: string;
  sessionVersion: number;
}

export function signJwt(payload: AuthTokenPayload): string {
  const options: SignOptions = { algorithm: "HS256", expiresIn: TOKEN_TTL_SECONDS };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyJwt(token: string): AuthTokenPayload | null {
  try {
    if (token.length > 4096) return null;
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof decoded === "object" && decoded && "id" in decoded) {
      const raw = decoded as { id: unknown; sessionVersion?: unknown; exp?: unknown };
      if (typeof raw.id !== "string" || !raw.id || raw.id.length > 128 ||
        !Number.isSafeInteger(raw.sessionVersion) || Number(raw.sessionVersion) < 0 ||
        typeof raw.exp !== "number") return null;
      return {
        id: raw.id,
        sessionVersion: raw.sessionVersion as number,
      };
    }
    return null;
  } catch {
    return null;
  }
}
