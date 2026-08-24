import { z } from "zod";

/**
 * اسکیماهای اعتبارسنجی مشترک بین کلاینت (react-hook-form) و سرور (route handlers).
 * با این کار منطق اعتبارسنجی فقط یک‌جا تعریف می‌شود.
 */

const email = z
  .string()
  .min(1, "ایمیل را وارد کنید")
  .email("ایمیل معتبر وارد کنید");

const identifier = z
  .string()
  .trim()
  .min(1, "ایمیل یا نام کاربری را وارد کنید")
  .max(255, "مقدار واردشده بیش از حد طولانی است");

const verificationCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "کد تایید باید ۶ رقم باشد");

export const verificationPurposeSchema = z.enum([
  "email_verification",
  "login",
  "password_reset",
]);

// رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد
const password = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .max(72, "رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد")
  .regex(/[a-zA-Z]/, "رمز عبور باید حداقل یک حرف داشته باشد")
  .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد");

// تغییر رمز عبور (کاربر واردشده) — همان قواعد رمز قوی را به‌کار می‌برد
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید"),
    newPassword: password,
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const loginSchema = z.object({
  identifier,
  // در ورود فقط وجود رمز را چک می‌کنیم تا پیام‌های اعتبارسنجی سخت‌گیرانه لو ندهند
  password: z.string().min(1, "رمز عبور را وارد کنید"),
  rememberMe: z.boolean(),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(3, "نام باید حداقل ۳ کاراکتر باشد")
      .max(255, "نام خیلی طولانی است"),
    email,
    password,
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند",
    path: ["confirmPassword"],
  });

// نسخه‌ی سمت سرور ثبت‌نام (بدون confirmPassword که فقط دغدغه‌ی کلاینت است)
export const registerApiSchema = z.object({
  name: z
    .string()
    .min(3, "نام باید حداقل ۳ کاراکتر باشد")
    .max(255, "نام خیلی طولانی است"),
  email,
  password,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const requestCodeSchema = z.object({
  email,
  purpose: verificationPurposeSchema,
});

export const verifyCodeSchema = z.object({
  email,
  code: verificationCode,
  purpose: verificationPurposeSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "توکن بازیابی نامعتبر است"),
    password,
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند",
    path: ["confirmPassword"],
  });

// نسخه‌ی سمت سرور بازنشانی رمز (بدون confirmPassword)
export const resetPasswordApiSchema = z.object({
  token: z.string().min(1, "توکن بازیابی نامعتبر است"),
  password,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
