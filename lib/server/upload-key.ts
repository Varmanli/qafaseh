// ساختِ کلیدِ یکتا و امنِ آبجکت برای آپلود (مشترک بین درایور S3 و محلی).
// از کاراکترهای غیرمجاز/پیمایش مسیر جلوگیری می‌کند تا اجرای دلخواهِ فایل یا
// نوشتن خارج از پوشه‌ی مقصد ممکن نباشد.

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".ico"]);

export function getFilenameExtension(filename: string): string {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/i);
  const ext = match?.[1]?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
}

export function sanitizeFilename(filename: string): string {
  const ext = getFilenameExtension(filename);
  const withoutExt = filename.replace(/\.[a-z0-9]+$/i, "");

  const cleaned = withoutExt
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${cleaned || "image"}${ext}`;
}

export function buildUploadKey(folder: string, filename: string): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_\-/]/g, "").replace(/\.\./g, "");
  const safeFilename = sanitizeFilename(filename);
  return `${safeFolder}/${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;
}

