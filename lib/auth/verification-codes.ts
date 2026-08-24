import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { PasswordResetToken, User, VerificationCode } from "@/db/schema";
import { AuthError } from "@/lib/auth/service";
import { generateResetToken } from "@/lib/auth/tokens";
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
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${purpose}:${code}`)
    .digest("hex");
}

export function canExposeDevCode() {
  return process.env.NODE_ENV !== "production" && isEmailDevMode;
}

async function getLatestCode(email: string, purpose: VerificationCodePurpose) {
  const [record] = await db
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
  const now = new Date();
  const latest = await getLatestCode(email, input.purpose);

  if (
    latest &&
    now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new AuthError(
      "برای ارسال دوباره کد، ۶۰ ثانیه صبر کنید.",
      429,
      "CODE_COOLDOWN"
    );
  }

  if (input.requireExistingUser || input.requireVerifiedUser) {
    const [user] = await db
      .select({ id: User.id, emailVerified: User.emailVerified })
      .from(User)
      .where(eq(User.email, email))
      .limit(1);

    if (!user) return {};
    if (input.requireVerifiedUser && !user.emailVerified) return {};
  }

  await db
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
  await db.insert(VerificationCode).values({
    email,
    codeHash: hashVerificationCode(email, code, input.purpose),
    purpose: input.purpose,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    maxAttempts: MAX_ATTEMPTS,
  });

  await sendVerificationCodeEmail({
    to: email,
    code,
    purpose: input.purpose,
  });

  return canExposeDevCode() ? { devCode: code } : {};
}

export async function verifyVerificationCode(input: {
  email: string;
  code: string;
  purpose: VerificationCodePurpose;
}): Promise<
  | { status: "verified"; userId?: string; resetToken?: string }
  | { status: "generic" }
> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  const record = await getLatestCode(email, input.purpose);

  if (!record || record.consumedAt) {
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
    await db
      .update(VerificationCode)
      .set({
        attempts: nextAttempts,
        updatedAt: new Date(),
        ...(nextAttempts >= record.maxAttempts ? { consumedAt: new Date() } : {}),
      })
      .where(eq(VerificationCode.id, record.id));

    if (nextAttempts >= record.maxAttempts) {
      throw new AuthError(
        "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً دوباره کد دریافت کنید.",
        429,
        "MAX_ATTEMPTS_EXCEEDED"
      );
    }

    throw new AuthError("کد واردشده نامعتبر است.", 400, "INVALID_CODE");
  }

  await db
    .update(VerificationCode)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(eq(VerificationCode.id, record.id));

  if (input.purpose === "email_verification") {
    const [user] = await db
      .select({ id: User.id })
      .from(User)
      .where(eq(User.email, email))
      .limit(1);

    if (!user) return { status: "generic" };

    await db
      .update(User)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(User.id, user.id));

    return { status: "verified", userId: user.id };
  }

  if (input.purpose === "login") {
    const [user] = await db
      .select({ id: User.id, emailVerified: User.emailVerified })
      .from(User)
      .where(eq(User.email, email))
      .limit(1);

    if (!user || !user.emailVerified) {
      throw new AuthError(
        "برای ورود با کد، ابتدا ایمیل خود را تایید کنید.",
        403,
        "EMAIL_NOT_VERIFIED"
      );
    }

    return { status: "verified", userId: user.id };
  }

  const [user] = await db
    .select({ id: User.id })
    .from(User)
    .where(eq(User.email, email))
    .limit(1);

  if (!user) return { status: "generic" };

  const { token, tokenHash } = generateResetToken();
  await db.insert(PasswordResetToken).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });

  return {
    status: "verified",
    resetToken: token,
  };
}
