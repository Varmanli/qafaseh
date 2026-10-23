import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

// Cheap read endpoints use bounded local buckets; authentication and uploads
// use the shared PostgreSQL limiter below.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (!existing && buckets.size >= MAX_BUCKETS) {
      sweep();
      if (buckets.size >= MAX_BUCKETS) return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** کلید محدودسازی را از روی IP درخواست و نام مسیر می‌سازد. */
export function getClientKey(req: Pick<NextRequest, "headers">, scope: string): string {
  // Enable only a header overwritten by the trusted ingress. The default
  // uses a shared bucket instead of trusting attacker-supplied IP headers.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  const value = header ? req.headers.get(header)?.split(",").at(-1)?.trim() : undefined;
  return `${scope}:${value && isIP(value) ? value : "unknown"}`;
}

/** Atomic PostgreSQL buckets survive restarts and are shared by all instances. */
export async function sharedRateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): Promise<RateLimitResult> {
  await sweepSharedRateLimits();
  const { pool } = await import("@/db");
  const hashedKey = createHash("sha256").update(key).digest("hex");
  const result = await pool.query<{ count: number; retry_after: number }>(`
    INSERT INTO "SecurityRateLimit" (key, count, reset_at)
    VALUES ($1, 1, clock_timestamp() + $2 * interval '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "SecurityRateLimit".reset_at <= clock_timestamp() THEN 1
        ELSE LEAST("SecurityRateLimit".count + 1, $3 + 1) END,
      reset_at = CASE WHEN "SecurityRateLimit".reset_at <= clock_timestamp()
        THEN clock_timestamp() + $2 * interval '1 millisecond' ELSE "SecurityRateLimit".reset_at END
    RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - clock_timestamp()))))::int AS retry_after
  `, [hashedKey, windowMs, limit]);
  const bucket = result.rows[0];
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: bucket.count <= limit ? 0 : bucket.retry_after };
}

let lastSharedSweep = 0;
export async function sweepSharedRateLimits() {
  if (Date.now() - lastSharedSweep < 60_000) return;
  lastSharedSweep = Date.now();
  const { pool } = await import("@/db");
  await pool.query('DELETE FROM "SecurityRateLimit" WHERE key IN (SELECT key FROM "SecurityRateLimit" WHERE reset_at <= clock_timestamp() LIMIT 1000)');
}

// به‌مرور سطل‌های منقضی‌شده را پاک می‌کند تا حافظه رشد بی‌رویه نکند.
function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
if (typeof setInterval !== "undefined") {
  const timer = setInterval(sweep, 5 * 60_000);
  // مانع از زنده نگه‌داشتن پروسه می‌شود (در محیط Node)
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}
