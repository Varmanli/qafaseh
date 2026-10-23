import crypto from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { PasswordResetToken, User, VerificationCode } from "@/db/schema";
import { AuthError } from "@/lib/auth/service";
import { generateResetToken } from "@/lib/auth/tokens";
import { getJwtSecret } from "@/lib/jwt";
import { isEmailDevMode, sendVerificationCodeEmail, type VerificationCodePurpose } from "@/lib/email";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(
  email: string,
  code: string,
  purpose: VerificationCodePurpose
) {
  return crypto
    .createHmac("sha256", getJwtSecret())
    .update(`email-otp:${normalizeEmail(email)}:${purpose}:${code}`)
    .digest("hex");
}

export function canExposeDevCode() {
  return process.env.NODE_ENV !== "production" && isEmailDevMode;
}

async function getLatestCode(reader: Pick<typeof db, "select">, email: string, purpose: VerificationCodePurpose) {
  const [record] = await reader
    .select()
    .from(VerificationCode)
    .where(
      and(
        eq(VerificationCode.email, normalizeEmail(email)),
        eq(VerificationCode.purpose, purpose)
      )
    )
    .orderBy(desc(VerificationCode.createdAt))
    .limit(1);

  return record ?? null;
}

export async function issueVerificationCode(input: {
  email: string;
  purpose: VerificationCodePurpose;
  requireExistingUser?: boolean;
  requireVerifiedUser?: boolean;
}): Promise<{ devCode?: string }> {
  const email = normalizeEmail(input.email);
  const issued = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'verification:' + email + ':' + input.purpose}, 0))`);
    const now = new Date();
    const latest = await getLatestCode(tx, email, input.purpose);

    if (
      latest &&
      latest.expiresAt.getTime() > now.getTime() &&
      now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new AuthError(
        "برای ارسال دوباره کد، ۶۰ ثانیه صبر کنید.",
        429,
        "CODE_COOLDOWN"
      );
    }

    if (input.requireExistingUser || input.requireVerifiedUser) {
      const [user] = await tx
        .select({ id: User.id, emailVerified: User.emailVerified })
        .from(User)
        .where(eq(User.email, email))
        .limit(1);

      if (!user) return null;
      if (input.requireVerifiedUser && !user.emailVerified) return null;
    }

    await tx
      .update(VerificationCode)
      .set({ consumedAt: now, updatedAt: now })
      .where(
        and(
          eq(VerificationCode.email, email),
          eq(VerificationCode.purpose, input.purpose),
          isNull(VerificationCode.consumedAt)
        )
      );

    const code = generateVerificationCode();
    const [record] = await tx.insert(VerificationCode).values({
      email,
      codeHash: hashVerificationCode(email, code, input.purpose),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      maxAttempts: MAX_ATTEMPTS,
      deliveryAccepted: false,
      createdAt: now,
    }).returning({ id: VerificationCode.id });

    return { code, id: record.id };
  });
  if (!issued) return {};

  const delivery = await sendVerificationCodeEmail({
    to: email,
    code: issued.code,
    purpose: input.purpose,
  });
  if (!delivery.ok && !(delivery.reason === "development" && canExposeDevCode())) {
    await db.delete(VerificationCode).where(eq(VerificationCode.id, issued.id));
    throw new AuthError("ارسال ایمیل ممکن نشد؛ کمی بعد دوباره تلاش کنید", 503, "EMAIL_DELIVERY_FAILED");
  }
  await db.update(VerificationCode).set({ deliveryAccepted: true }).where(eq(VerificationCode.id, issued.id));
  return canExposeDevCode() ? { devCode: issued.code } : {};
}

export async function verifyVerificationCode(input: {
  email: string;
  code: string;
  purpose: VerificationCodePurpose;
}): Promise<
  | { status: "verified"; userId?: string; sessionVersion?: number; resetToken?: string }
  | { status: "generic" }
> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'verification:' + email + ':' + input.purpose}, 0))`);
    const record = await getLatestCode(tx, email, input.purpose);

    if (!record || record.consumedAt || !record.deliveryAccepted) {
      throw new AuthError("کد واردشده نامعتبر است.", 400, "INVALID_CODE");
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(
        "کد منقضی شده است. لطفاً دوباره کد دریافت کنید.",
        400,
        "CODE_EXPIRED"
      );
    }

    if (record.attempts >= record.maxAttempts) {
      throw new AuthError(
        "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً دوباره کد دریافت کنید.",
        429,
        "MAX_ATTEMPTS_EXCEEDED"
      );
    }

    const expectedHash = hashVerificationCode(email, code, input.purpose);
    if (expectedHash !== record.codeHash) {
      const nextAttempts = record.attempts + 1;
      await tx
        .update(VerificationCode)
        .set({
          attempts: nextAttempts,
          updatedAt: new Date(),
          ...(nextAttempts >= record.maxAttempts ? { consumedAt: new Date() } : {}),
        })
        .where(eq(VerificationCode.id, record.id));

      if (nextAttempts >= record.maxAttempts) {
        return new AuthError(
          "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً دوباره کد دریافت کنید.",
          429,
          "MAX_ATTEMPTS_EXCEEDED"
        );
      }

      return new AuthError("کد واردشده نامعتبر است.", 400, "INVALID_CODE");
    }

    await tx
      .update(VerificationCode)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(VerificationCode.id, record.id));

    if (input.purpose === "email_verification") {
      const [user] = await tx
        .select({ id: User.id })
        .from(User)
        .where(eq(User.email, email))
        .limit(1);

      if (!user) return { status: "generic" as const };

      await tx
        .update(User)
        .set({ emailVerified: new Date(), updatedAt: new Date() })
        .where(eq(User.id, user.id));

      return { status: "verified" as const, userId: user.id };
    }

    if (input.purpose === "login") {
      const [user] = await tx
        .select({ id: User.id, emailVerified: User.emailVerified, sessionVersion: User.sessionVersion })
        .from(User)
        .where(eq(User.email, email))
        .limit(1)
        .for("update");

      if (!user) {
        throw new AuthError(
          "حسابی با این ایمیل یافت نشد.",
          403,
          "USER_NOT_FOUND"
        );
      }

      const version = user.sessionVersion + (user.emailVerified ? 0 : 1);
      if (!user.emailVerified) {
        // Proof of email ownership must revoke a possible pre-hijacker's password.
        await tx.update(User).set({ emailVerified: new Date(), password: null, passwordHash: null, authProvider: "otp", sessionVersion: version, updatedAt: new Date() })
          .where(eq(User.id, user.id));
        await tx.update(PasswordResetToken).set({ usedAt: new Date() })
          .where(and(eq(PasswordResetToken.userId, user.id), isNull(PasswordResetToken.usedAt)));
      }
      return { status: "verified" as const, userId: user.id, sessionVersion: version };
    }

    const [user] = await tx
      .select({ id: User.id })
      .from(User)
      .where(eq(User.email, email))
      .limit(1);

    if (!user) return { status: "generic" as const };

    const { token, tokenHash } = generateResetToken();
    await tx.insert(PasswordResetToken).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    return {
      status: "verified" as const,
      resetToken: token,
    };
  });
  if (result instanceof AuthError) throw result;
  return result;
}
