const DEFAULT_STORAGE_PUBLIC_BASE =
  "https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir";

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function storagePublicBase() {
  return (
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
    process.env.S3_PUBLIC_BASE_URL ||
    DEFAULT_STORAGE_PUBLIC_BASE
  ).replace(/\/+$/, "");
}

function usesLocalUploadDriver() {
  return process.env.NODE_ENV === "development" && process.env.UPLOAD_DRIVER !== "s3";
}

export type EditionCoverLike = {
  coverImage?: string | null;
  coverUrl?: string | null;
};

/**
 * Resolves every persisted media format to its original source URL.  It never
 * builds a Next.js optimizer URL, so the same value is safe for SSR, client
 * rendering, metadata, and direct storage access.
 */
export function normalizeMediaUrl(input?: string | null): string | null {
  let raw = input?.trim();
  if (!raw || raw === "null" || raw === "undefined") return null;

  // Some legacy imports stored an encoded source URL. Decode only once when it
  // is clearly an encoded absolute URL; do not touch ordinary URL characters.
  if (/^https?%3a/i.test(raw)) {
    try {
      const decoded = decodeURIComponent(raw);
      if (/^https?:\/\//i.test(decoded)) raw = decoded;
    } catch {
      return null;
    }
  }

  // Optimizer URLs are implementation details, not persisted media sources.
  if (/^\/?_next\/image(?:\?|\/|$)/i.test(raw)) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  // Compatibility for IranKetab rows written before canonical object-key
  // persistence. These objects live in Arvan, never in local public/uploads.
  if (/^\/uploads\/covers\/iranketab-[^/]+\.webp(?:\?.*)?$/i.test(raw)) {
    raw = raw.replace(/^\/uploads\//i, "");
  }
  if (raw.startsWith("/")) {
    const key = normalizePath(raw);
    if (/^(blog|books|covers|authors|avatars|references|publishers|translators|settings|quotes|quote-backgrounds)\//i.test(key)) {
      return usesLocalUploadDriver() ? `/uploads/${key}` : `${storagePublicBase()}/${key}`;
    }
    return raw;
  }
  if (raw.startsWith("uploads/")) return `/${normalizePath(raw)}`;
  if (/^(blog|books|covers|authors|avatars|references|publishers|translators|settings|quotes|quote-backgrounds)\//i.test(raw)) {
    const key = normalizePath(raw);
    return usesLocalUploadDriver() ? `/uploads/${key}` : `${storagePublicBase()}/${key}`;
  }

  return null;
}

/** Backwards-compatible name for book-cover callers. */
export const normalizeCoverImage = normalizeMediaUrl;

export function coalesceCoverImage(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeCoverImage(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function getEditionCoverSrc(
  edition?: EditionCoverLike | null,
  ...fallbacks: Array<string | null | undefined>
): string | null {
  return (
    coalesceCoverImage(edition?.coverImage, edition?.coverUrl) ??
    coalesceCoverImage(...fallbacks)
  );
}
