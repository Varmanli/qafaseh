import {
  groupBooks,
  normalizeFlatRowToBook,
  normalizeNestedBook,
} from "@/lib/books/import/normalize";
import type { NormalizedImportBook } from "@/lib/books/import/types";

export function parseImportJson(content: string): NormalizedImportBook[] {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON_IMPORT_ARRAY_REQUIRED");
  }
  if (parsed.length > 5000) throw new Error("IMPORT_TOO_MANY_ROWS");

  const books = parsed.map((entry, index) => {
    const rowNumber = index + 1;
    const record = (entry ?? {}) as Record<string, unknown>;
    return Array.isArray(record.editions)
      ? normalizeNestedBook(record, rowNumber)
      : normalizeFlatRowToBook(record, rowNumber);
  });

  return groupBooks(books);
}
