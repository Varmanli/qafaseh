import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { Account, PasswordResetToken, User } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateUniqueUsername } from "@/lib/profile/username";
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/auth/tokens";
import { sendPasswordResetEmail, isDev } from "@/lib/email";
import { signJwt } from "@/lib/jwt";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function isGoogleAvatarUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    return new URL(value).hostname.toLowerCase().endsWith("googleusercontent.com");
  } catch {
    return false;
  }
}

/** A manually supplied avatar always wins over an OAuth provider image. */
function resolveGoogleAvatar(existingImage: string | null, googleImage?: string | null) {
  if (!googleImage?.trim()) return existingImage;
  return !existingImage || isGoogleAvatarUrl(existingImage)
    ? googleImage
    : existingImage;
}

/** خطای کنترل‌شده‌ی احراز هویت که route handler آن را به پاسخ HTTP تبدیل می‌کند. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface PublicUser {
  id: string;
  name: string | null;
  email: string | null;
  username?: string | null;
  image?: string | null;
  sessionVersion?: number;
}

// ---------------- ثبت‌نام ----------------
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const email = normalizeEmail(input.email);

  const [existing] = await db
    .select({ id: User.id })
    .from(User)
    .where(eq(User.email, email));

  if (existing) {
    throw new AuthError("کاربری با این ایمیل قبلاً ثبت‌نام کرده است", 409, "EMAIL_TAKEN");
  }

  const hashed = await hashPassword(input.password);
  const username = await generateUniqueUsername();

  const [user] = await db
    .insert(User)
    .values({
      name: input.name.trim(),
      email,
      password: hashed,
      passwordHash: hashed,
      authProvider: "password",
      username,
      profileVisibility: "PUBLIC",
    })
    .returning({
      id: User.id,
      name: User.name,
      email: User.email,
      username: User.username,
    });

  return user;
}

// ---------------- تغییر رمز عبور (کاربر واردشده) ----------------
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const [user] = await db
    .select({
      id: User.id,
      password: User.password,
      passwordHash: User.passwordHash,
      sessionVersion: User.sessionVersion,
    })
    .from(User)
    .where(eq(User.id, userId));

  const currentHash = user?.passwordHash ?? user?.password ?? null;
  if (!user || !currentHash) {
    throw new AuthError("کاربر یافت نشد", 404, "USER_NOT_FOUND");
  }

  const ok = await verifyPassword(currentPassword, currentHash);
  if (!ok) {
    throw new AuthError(
      "رمز عبور فعلی اشتباه است",
      400,
      "INVALID_CURRENT_PASSWORD"
    );
  }

  const hashed = await hashPassword(newPassword);
  await db
    .update(User)
    .set({
      password: hashed,
      passwordHash: hashed,
      authProvider: "password",
      sessionVersion: (user.sessionVersion ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(User.id, userId));
}

// ---------------- ورود ----------------
export async function authenticateUser(input: {
  identifier: string;
  password: string;
}): Promise<PublicUser> {
  const rawIdentifier = input.identifier.trim();
  const normalized = rawIdentifier.toLowerCase();

  const [user] = await db
    .select()
    .from(User)
    .where(
      rawIdentifier.includes("@")
        ? eq(User.email, normalized)
        : or(eq(User.email, normalized), eq(User.username, normalized))
    );

  // پیام یکسان برای «کاربر یافت نشد» و «رمز اشتباه» تا اطلاعات لو نرود
  const invalid = () =>
    new AuthError(
      "ایمیل، نام کاربری یا رمز عبور اشتباه است",
      401,
      "INVALID_CREDENTIALS"
    );

  const passwordHash = user?.passwordHash ?? user?.password ?? null;
  if (!user || !passwordHash) {
    // برای جلوگیری از تشخیص وجود کاربر از روی زمان پاسخ، یک مقایسه‌ی ساختگی انجام می‌دهیم
    await verifyPassword(input.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    throw invalid();
  }

  const ok = await verifyPassword(input.password, passwordHash);
  if (!ok) throw invalid();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    sessionVersion: user.sessionVersion,
  };
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  const [user] = await db
    .select({
      id: User.id,
      name: User.name,
      email: User.email,
      username: User.username,
      image: User.image,
      sessionVersion: User.sessionVersion,
    })
    .from(User)
    .where(eq(User.email, normalizeEmail(email)))
    .limit(1);

  return user ?? null;
}

export async function createAuthTokenForUser(userId: string): Promise<string> {
  const [user] = await db
    .select({ id: User.id, sessionVersion: User.sessionVersion })
    .from(User)
    .where(eq(User.id, userId))
    .limit(1);

  if (!user) {
    throw new AuthError("کاربر یافت نشد", 404, "USER_NOT_FOUND");
  }

  return signJwt({
    id: user.id,
    sessionVersion: user.sessionVersion ?? 0,
  });
}

export async function findOrCreateGoogleUser(input: {
  email: string;
  googleId: string;
  name?: string | null;
  image?: string | null;
}): Promise<PublicUser> {
  const email = normalizeEmail(input.email);

  const [existingByGoogle] = await db
    .select({
      id: User.id,
      name: User.name,
      email: User.email,
      username: User.username,
      image: User.image,
      sessionVersion: User.sessionVersion,
    })
    .from(User)
    .where(eq(User.googleId, input.googleId))
    .limit(1);

  if (existingByGoogle) {
    const image = resolveGoogleAvatar(existingByGoogle.image, input.image);
    await db
      .update(User)
      .set({
        emailVerified: new Date(),
        image,
        updatedAt: new Date(),
      })
      .where(eq(User.id, existingByGoogle.id));
    return { ...existingByGoogle, image };
  }

  const [existingByEmail] = await db
    .select({
      id: User.id,
      name: User.name,
      email: User.email,
      username: User.username,
      image: User.image,
      authProvider: User.authProvider,
      sessionVersion: User.sessionVersion,
    })
    .from(User)
    .where(eq(User.email, email))
    .limit(1);

  if (existingByEmail) {
    const image = resolveGoogleAvatar(existingByEmail.image, input.image);
    await db.transaction(async (tx) => {
      await tx
        .update(User)
        .set({
          googleId: input.googleId,
          emailVerified: new Date(),
          image,
          updatedAt: new Date(),
        })
        .where(eq(User.id, existingByEmail.id));

      const [account] = await tx
        .select({ id: Account.id })
        .from(Account)
        .where(
          and(
            eq(Account.userId, existingByEmail.id),
            eq(Account.provider, "google"),
            eq(Account.providerAccountId, input.googleId)
          )
        )
        .limit(1);

      if (!account) {
        await tx.insert(Account).values({
          userId: existingByEmail.id,
          type: "oauth",
          provider: "google",
          providerAccountId: input.googleId,
        });
      }
    });

    return { ...existingByEmail, image };
  }

  const username = await generateUniqueUsername();

  const [created] = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(User)
      .values({
        name: input.name?.trim() || "کاربر قفسه",
        email,
        emailVerified: new Date(),
        image: input.image ?? null,
        authProvider: "google",
        googleId: input.googleId,
        username,
        profileVisibility: "PUBLIC",
      })
      .returning({
        id: User.id,
        name: User.name,
        email: User.email,
        username: User.username,
        image: User.image,
        sessionVersion: User.sessionVersion,
      });

    await tx.insert(Account).values({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: input.googleId,
    });

    return [user];
  });

  return created;
}

// ---------------- درخواست بازیابی رمز ----------------
/**
 * همیشه با موفقیت بازمی‌گردد (تا وجود/نبود ایمیل لو نرود).
 * در محیط توسعه، لینک بازیابی را برمی‌گرداند تا تست ممکن باشد.
 */
export async function requestPasswordReset(
  email: string,
  appUrl: string
): Promise<{ devResetUrl?: string }> {
  const normalized = normalizeEmail(email);

  const [user] = await db
    .select({ id: User.id, email: User.email })
    .from(User)
    .where(eq(User.email, normalized));

  if (!user) {
    return {}; // پاسخ عمومی، بدون افشای اینکه ایمیل وجود ندارد
  }

  // توکن‌های مصرف‌نشده‌ی قبلی این کاربر را باطل می‌کنیم
  await db
    .update(PasswordResetToken)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(PasswordResetToken.userId, user.id),
        isNull(PasswordResetToken.usedAt)
      )
    );

  const { token, tokenHash } = generateResetToken();

  await db.insert(PasswordResetToken).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

  await sendPasswordResetEmail({ to: user.email!, resetUrl });

  // فقط در توسعه لینک را برمی‌گردانیم
  return isDev ? { devResetUrl: resetUrl } : {};
}

// ---------------- بازنشانی رمز ----------------
export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const tokenHash = hashResetToken(input.token);

  const [record] = await db
    .select()
    .from(PasswordResetToken)
    .where(
      and(
        eq(PasswordResetToken.tokenHash, tokenHash),
        isNull(PasswordResetToken.usedAt),
        gt(PasswordResetToken.expiresAt, new Date())
      )
    );

  if (!record) {
    throw new AuthError(
      "لینک بازیابی نامعتبر یا منقضی شده است. دوباره درخواست دهید.",
      400,
      "INVALID_RESET_TOKEN"
    );
  }

  const hashed = await hashPassword(input.password);

  // به‌روزرسانی رمز و باطل‌کردن توکن (یک‌بارمصرف) به‌صورت اتمیک
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ sessionVersion: User.sessionVersion })
      .from(User)
      .where(eq(User.id, record.userId))
      .limit(1);

    await tx
      .update(User)
      .set({
        password: hashed,
        passwordHash: hashed,
        authProvider: "password",
        sessionVersion: (user?.sessionVersion ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(User.id, record.userId));

    await tx
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where(eq(PasswordResetToken.id, record.id));

    await tx
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(PasswordResetToken.userId, record.userId),
          isNull(PasswordResetToken.usedAt)
        )
      );
  });
}

/** پاک‌سازی توکن‌های منقضی‌شده (اختیاری، می‌توان در یک cron job صدا زد). */
export async function purgeExpiredResetTokens(): Promise<void> {
  await db
    .delete(PasswordResetToken)
    .where(lt(PasswordResetToken.expiresAt, new Date()));
}
