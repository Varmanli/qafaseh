/**
 * تشخیص ادمین: نقش ADMIN یا ایمیل تأییدشده در ADMIN_EMAILS.
 * (برای راه‌اندازی اولین ادمین بدون ویرایش مستقیم دیتابیس).
 */
export function isAdmin(
  user: { role?: string | null; email?: string | null; emailVerified?: Date | string | null } | null | undefined
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return !!user.emailVerified && !!user.email && allow.includes(user.email.trim().toLowerCase());
}
