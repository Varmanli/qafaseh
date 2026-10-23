import { timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { User } from "@/db/schema";
import { isAdmin } from "@/lib/auth/roles";
import { apiError } from "@/lib/api/response";

/**
 * Authenticates the deployment scheduler, not an end user. AUTO_IMPORT needs a
 * real admin actor because the existing importer records ownership/audit data.
 */
export async function assertIranKetabDiscoveryWorkerRequest(request: Request) {
  const secret = process.env.IRANKETAB_DISCOVERY_WORKER_SECRET;
  const actorId = process.env.IRANKETAB_DISCOVERY_WORKER_ACTOR_ID;
  if (!secret || !actorId)
    return { error: apiError("پردازشگر کشف پیکربندی نشده است", 503, "DISCOVERY_WORKER_NOT_CONFIGURED") } as const;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(token, secret))
    return { error: apiError("دسترسی غیرمجاز", 401, "UNAUTHORIZED_WORKER") } as const;

  const [actor] = await db
    .select({ id: User.id, email: User.email, emailVerified: User.emailVerified, role: User.role })
    .from(User)
    .where(eq(User.id, actorId))
    .limit(1);
  if (!isAdmin(actor))
    return { error: apiError("کاربر پردازشگر دسترسی ادمین ندارد", 503, "DISCOVERY_WORKER_ACTOR_INVALID") } as const;

  return { actorId: actor.id } as const;
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
