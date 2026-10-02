import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { User } from "@/db/schema";
import { verifyJwt } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth/cookies";
import { ensureUserHasUsername } from "@/lib/profile/username";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  username: string | null;
  role: "USER" | "ADMIN";
  authProvider: "password" | "google" | "otp";
  sessionVersion: number;
}

/**
 * کاربر فعلی را از روی کوکی توکن می‌خواند و وجودش را در دیتابیس تأیید می‌کند.
 * در صورت نبود/نامعتبری توکن یا حذف کاربر، null برمی‌گرداند.
 * فقط در سرور (Server Components / Route Handlers) قابل استفاده است.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload?.id) return null;

  const [user] = await db
    .select({
      id: User.id,
      name: User.name,
      email: User.email,
      image: User.image,
      username: User.username,
      role: User.role,
      authProvider: User.authProvider,
      sessionVersion: User.sessionVersion,
    })
    .from(User)
    .where(eq(User.id, payload.id));

  if (!user) return null;
  if ((user.sessionVersion ?? 0) !== (payload.sessionVersion ?? -1)) {
    return null;
  }

  if (user && !user.username) {
    user.username = await ensureUserHasUsername(user.id);
  }

  return user;
});
