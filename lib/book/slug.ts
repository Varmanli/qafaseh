// ابزار اسلاگ کتاب — توابع خالص بدون وابستگی به دیتابیس (قابل استفاده در کلاینت).

/** آیا مقدار یک UUID است؟ (لینک‌های قدیمی بر پایه‌ی id). */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Normalizes Persian/Arabic text before it is used as a public URL key.
 *
 * This deliberately makes a half-space a word separator. Removing it joins
 * two words ("می‌شود" -> "میشود"), which made otherwise equivalent URLs
 * impossible to resolve reliably.
 */
export function normalizePersianText(input: string): string {
  return (input || "")
    .normalize("NFKC")
    .replace(/[يىئ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 1776))
    .replace(/[ـ]/g, "")
    .replace(/[\u200c\u200d\u200e\u200f\u2066-\u2069]/g, " ")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US");
}

/**
 * ساخت اسلاگ از عنوان. حروف فارسی/لاتین و اعداد حفظ می‌شوند؛ فاصله و نشانه‌ها
 * به خط تیره تبدیل می‌شوند. This is the only normalization used for public
 * book and reference route keys.
 */
export function slugify(input: string): string {
  return normalizePersianText(input)
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * اسلاگ یکتا از روی عنوان + مجموعه‌ی اسلاگ‌های گرفته‌شده. اگر پایه خالی بود یا
 * تکراری بود، پسوند کوتاه اضافه می‌شود.
 */
export function uniqueSlug(
  title: string,
  taken: Set<string>,
  fallback: string
): string {
  const base = slugify(title) || slugify(fallback) || "book";
  if (!taken.has(base)) return base;
  // پسوند کوتاه افزایشی
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // در عمل هرگز به اینجا نمی‌رسیم؛ پسوند تصادفی به‌عنوان پشتیبان
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
