import { normalizePersianText } from "@/lib/book/slug";

/** The one normalization contract used by search input and indexed values. */
export function normalizeSearchText(value: string): string {
  return normalizePersianText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes word separators so spaced and unspaced Persian forms match. */
export function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}
