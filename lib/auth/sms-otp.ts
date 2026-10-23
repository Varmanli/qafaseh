import { createHmac, randomInt } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { PasswordResetToken, SmsVerificationCode, User } from "@/db/schema";
import { getJwtSecret } from "@/lib/jwt";
import { generateUniqueUsername } from "@/lib/profile/username";
import { AuthError } from "./service";
import { isSmsDevMode, sendSmsCode, SmsDeliveryError } from "./sms-delivery";
import { smsSignupNameSchema, type SmsPurpose } from "./phone";
import { generateResetToken } from "./tokens";
import { hashPassword } from "./password";
import { signupPasswordSchema } from "@/lib/validations/auth";

type Purpose = SmsPurpose;
const TTL_MS = 5 * 60_000;
const COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
const userColumns = { id: User.id, name: User.name, email: User.email, username: User.username, sessionVersion: User.sessionVersion };

function hashCode(phone: string, purpose: Purpose, code: string) {
  return createHmac("sha256", getJwtSecret()).update(`sms-otp:${phone}:${purpose}:${code}`).digest("hex");
}

export async function issueSmsOtp(phone: string, purpose: Purpose, userId?: string): Promise<{ devCode?: string }> {
  if (purpose === "link" && !userId) throw new AuthError("ابتدا وارد شوید", 401, "UNAUTHENTICATED");
  const code = randomInt(100000, 1000000).toString();
  const record = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'sms-otp:' + phone}, 0))`);
    const [recoveryOwner] = purpose === "recovery" ? await tx.select({ id: User.id, phoneVerified: User.phoneVerified })
      .from(User).where(eq(User.phone, phone)).limit(1) : [];
    if (purpose === "recovery" && !recoveryOwner?.phoneVerified) return null;
    const [latest] = await tx.select({ createdAt: SmsVerificationCode.createdAt, expiresAt: SmsVerificationCode.expiresAt }).from(SmsVerificationCode)
      .where(eq(SmsVerificationCode.phone, phone)).orderBy(desc(SmsVerificationCode.createdAt)).limit(1);
    if (latest && latest.expiresAt.getTime() > Date.now() && Date.now() - latest.createdAt.getTime() < COOLDOWN_MS) {
      throw new AuthError("برای ارسال دوباره ۶۰ ثانیه صبر کنید", 429, "CODE_COOLDOWN");
    }
    await tx.update(SmsVerificationCode).set({ consumedAt: new Date() })
      .where(and(eq(SmsVerificationCode.phone, phone), isNull(SmsVerificationCode.consumedAt)));
    const [created] = await tx.insert(SmsVerificationCode).values({
      phone, purpose, userId: purpose === "link" ? userId : recoveryOwner?.id ?? null,
      codeHash: hashCode(phone, purpose, code), expiresAt: new Date(Date.now() + TTL_MS), createdAt: new Date(),
    }).returning({ id: SmsVerificationCode.id });
    return created;
  });
  if (!record) return {};
  try {
    await sendSmsCode(phone, code);
    await db.update(SmsVerificationCode).set({ deliveryAccepted: true }).where(eq(SmsVerificationCode.id, record.id));
  } catch (error) {
    await db.delete(SmsVerificationCode).where(eq(SmsVerificationCode.id, record.id));
    const failure = error instanceof SmsDeliveryError ? error.code : "SMS_DELIVERY_FAILED";
    throw new AuthError("ارسال پیامک ممکن نشد؛ کمی بعد دوباره تلاش کنید", 503, failure);
  }
  return isSmsDevMode() ? { devCode: code } : {};
}

export async function verifySmsOtp(phone: string, code: string, purpose: Purpose, userId?: string, sessionVersion?: number, name?: string, password?: string) {
  const signupName = purpose === "signup" ? smsSignupNameSchema.safeParse(name ?? "کاربر قفسه") : null;
  if (signupName && !signupName.success) throw new AuthError("نام معتبر وارد کنید", 422, "INVALID_NAME");
  const signupPassword = purpose === "signup" ? signupPasswordSchema.safeParse(password) : null;
  if (signupPassword && !signupPassword.success) throw new AuthError("رمز عبور معتبر وارد کنید", 422, "INVALID_PASSWORD");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'sms-otp:' + phone}, 0))`);
    const [record] = await tx.select().from(SmsVerificationCode)
      .where(and(eq(SmsVerificationCode.phone, phone), eq(SmsVerificationCode.purpose, purpose)))
      .orderBy(desc(SmsVerificationCode.createdAt)).limit(1);
    if (!record || record.consumedAt || !record.deliveryAccepted || record.expiresAt.getTime() <= Date.now() || record.attempts >= MAX_ATTEMPTS) {
      throw new AuthError("کد نامعتبر یا منقضی شده است", 400, "INVALID_CODE");
    }
    if (purpose === "link" && (!userId || record.userId !== userId || !Number.isSafeInteger(sessionVersion))) {
      throw new AuthError("این کد متعلق به حساب شما نیست", 403, "FORBIDDEN");
    }
    if (hashCode(phone, purpose, code) !== record.codeHash) {
      const attempts = record.attempts + 1;
      await tx.update(SmsVerificationCode).set({ attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) })
        .where(eq(SmsVerificationCode.id, record.id));
      // Return the error so the failed attempt is committed, then throw outside.
      return new AuthError("کد واردشده نامعتبر است", attempts >= MAX_ATTEMPTS ? 429 : 400, "INVALID_CODE");
    }
    const [owner] = await tx.select({ ...userColumns, phoneVerified: User.phoneVerified }).from(User)
      .where(eq(User.phone, phone)).limit(1).for("update");
    if (purpose === "recovery") {
      if (!owner?.phoneVerified || record.userId !== owner.id) throw new AuthError("کد نامعتبر یا منقضی شده است", 400, "INVALID_CODE");
      const reset = generateResetToken();
      await tx.update(PasswordResetToken).set({ usedAt: new Date() })
        .where(and(eq(PasswordResetToken.userId, owner.id), isNull(PasswordResetToken.usedAt)));
      await tx.insert(PasswordResetToken).values({ userId: owner.id, tokenHash: reset.tokenHash, verificationMethod: "sms", expiresAt: new Date(Date.now() + 10 * 60_000) });
      await tx.update(SmsVerificationCode).set({ consumedAt: new Date() }).where(eq(SmsVerificationCode.id, record.id));
      return { ...owner, resetToken: reset.token };
    }
    let user;
    if (purpose === "link") {
      if (owner && owner.id !== userId) throw new AuthError("این شماره به حساب دیگری متصل است", 409, "PHONE_TAKEN");
      [user] = await tx.update(User).set({ phone, phoneVerified: new Date(), sessionVersion: sql`${User.sessionVersion} + 1`, updatedAt: new Date() })
        .where(and(eq(User.id, userId!), eq(User.sessionVersion, sessionVersion!))).returning(userColumns);
      if (!user) throw new AuthError("نشست تغییر کرده؛ دوباره وارد شوید", 401, "UNAUTHENTICATED");
      await tx.update(PasswordResetToken).set({ usedAt: new Date() })
        .where(and(eq(PasswordResetToken.userId, user.id), isNull(PasswordResetToken.usedAt)));
    } else if (owner) {
      if (!owner.phoneVerified) throw new AuthError("شماره این حساب تأیید نشده است", 403, "PHONE_NOT_VERIFIED");
      user = owner;
    } else {
      const passwordHash = signupPassword?.success ? await hashPassword(signupPassword.data) : null;
      [user] = await tx.insert(User).values({ phone, phoneVerified: new Date(), authProvider: passwordHash ? "password" : "otp", password: passwordHash, passwordHash, name: signupName?.success ? signupName.data : "کاربر قفسه", username: await generateUniqueUsername(tx) })
        .returning(userColumns);
    }
    await tx.update(SmsVerificationCode).set({ consumedAt: new Date() }).where(eq(SmsVerificationCode.id, record.id));
    return { id: user.id, name: user.name, email: user.email, username: user.username, sessionVersion: user.sessionVersion };
  });
  if (result instanceof AuthError) throw result;
  return result;
}
