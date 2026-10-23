import { z } from "zod";
import { signupPasswordSchema } from "@/lib/validations/auth";

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)));
}

export function normalizeIranianPhone(value: string): string | null {
  let phone = normalizeDigits(value.trim())
    .replace(/[\s().\-\u200e\u200f]/g, "");
  if (phone.startsWith("0098")) phone = phone.slice(4);
  else if (phone.startsWith("+98")) phone = phone.slice(3);
  else if (phone.startsWith("98") && phone.length === 12) phone = phone.slice(2);
  else if (phone.startsWith("0")) phone = phone.slice(1);
  return /^9\d{9}$/.test(phone) ? `+98${phone}` : null;
}

export const iranianPhoneSchema = z.string().max(40, "شماره موبایل بیش از حد طولانی است").transform(normalizeIranianPhone)
  .refine((value) => value !== null, "شماره موبایل ایران را وارد کنید")
  .transform((value) => value!);

export const smsRequestSchema = z.object({
  phone: iranianPhoneSchema,
  purpose: z.enum(["login", "link", "signup", "recovery"]).default("login"),
});
export type SmsPurpose = z.infer<typeof smsRequestSchema>["purpose"];
export const smsSignupNameSchema = z.string().trim().min(3, "نام باید حداقل ۳ کاراکتر باشد").max(255, "نام خیلی طولانی است");
export const smsVerifySchema = smsRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/, "کد باید شش رقم باشد"),
  rememberMe: z.boolean().default(true),
  name: smsSignupNameSchema.optional(),
  password: signupPasswordSchema.optional(),
  confirmPassword: z.string().max(1024).optional(),
}).refine((input) => input.purpose !== "signup" || Boolean(input.password), { path: ["password"], message: "رمز عبور را وارد کنید" })
  .refine((input) => input.purpose !== "signup" || input.password === input.confirmPassword, { path: ["confirmPassword"], message: "رمز عبور و تکرار آن یکسان نیستند" });
export function isSmsOtpEnabled() {
  return process.env.SMS_OTP_ENABLED === "true";
}

export function isSignupOtpEnabled() {
  return process.env.SIGNUP_OTP_ENABLED === "true";
}

export const phoneSignupStartSchema = z.object({ phone: iranianPhoneSchema });
export const phoneSignupSchema = phoneSignupStartSchema.extend({
  token: z.string().min(1, "ابتدا شماره موبایل را وارد کنید").max(2048),
  password: signupPasswordSchema,
  confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید").max(1024),
}).refine((input) => input.password === input.confirmPassword, {
  path: ["confirmPassword"], message: "رمز عبور و تکرار آن یکسان نیستند",
});
