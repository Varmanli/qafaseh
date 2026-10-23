import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { User } from "@/db/schema";
import { generateUniqueUsername } from "@/lib/profile/username";
import { isSignupOtpEnabled, phoneSignupSchema, phoneSignupStartSchema } from "./phone";
import { hashPassword } from "./password";
import { AuthError } from "./service";
import { createSignupToken, verifySignupToken } from "./signup-token";

function requirePasswordSignup() {
  if (isSignupOtpEnabled()) throw new AuthError("تأیید پیامکی برای ثبت‌نام الزامی است", 403, "SIGNUP_OTP_REQUIRED");
}

function phoneTaken() {
  return new AuthError("این شماره قبلاً ثبت شده است؛ وارد حساب خود شوید", 409, "PHONE_TAKEN");
}

export async function startPhoneSignup(input: unknown) {
  requirePasswordSignup();
  const parsed = phoneSignupStartSchema.safeParse(input);
  if (!parsed.success) throw new AuthError(parsed.error.issues[0].message, 422, "INVALID_INPUT");
  const { phone } = parsed.data;
  const [existing] = await db.select({ id: User.id }).from(User).where(eq(User.phone, phone)).limit(1);
  if (existing) throw phoneTaken();
  return { phone, token: createSignupToken(phone) };
}

export async function registerPhoneUser(input: unknown) {
  requirePasswordSignup();
  const parsed = phoneSignupSchema.safeParse(input);
  if (!parsed.success) throw new AuthError(parsed.error.issues[0].message, 422, "INVALID_INPUT");
  const { phone, password, token } = parsed.data;
  if (!verifySignupToken(token, phone)) throw new AuthError("مرحله شماره منقضی یا نامعتبر است؛ دوباره ادامه دهید", 403, "INVALID_SIGNUP_TOKEN");
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    // Use the same lock as OTP to serialize account creation across both flows.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'sms-otp:' + phone}, 0))`);
    const [user] = await tx.insert(User).values({
      phone, phoneVerified: null, name: "کاربر قفسه", authProvider: "password",
      password: passwordHash, passwordHash, username: await generateUniqueUsername(tx),
    }).onConflictDoNothing({ target: User.phone }).returning({
      id: User.id, name: User.name, email: User.email, username: User.username, sessionVersion: User.sessionVersion,
    });
    if (!user) throw phoneTaken();
    return user;
  });
}
