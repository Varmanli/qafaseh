import {
  normalizeReferenceInput,
  type ImportReferenceInput,
} from "@/lib/reference/service";
import { splitMultiValueText } from "@/lib/book/genres";
import { isAllowedPersistedImageUrl } from "@/lib/storage/image-url";
import { normalizeIsbn as normalizeImportIsbn } from "@/lib/books/import/isbn";
import { normalizeBookGroupingKey, normalizeBookTitle } from "@/lib/books/import/title-normalization";
import type {
  ImportStatus,
  NormalizedImportBook,
  NormalizedImportEdition,
  NormalizedImportReference,
} from "@/lib/books/import/types";

type FlatBookLike = {
  title?: unknown;
  subtitle?: unknown;
  originalTitle?: unknown;
  authors?: unknown;
  translators?: unknown;
  publisher?: unknown;
  language?: unknown;
  description?: unknown;
  genres?: unknown;
  country?: unknown;
  firstPublishedYear?: unknown;
  status?: unknown;
  bookStatus?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  titleOverride?: unknown;
  isbn10?: unknown;
  isbn13?: unknown;
  publishedYear?: unknown;
  pageCount?: unknown;
  coverFilename?: unknown;
  coverUrl?: unknown;
  editionDescription?: unknown;
  editionStatus?: unknown;
  sourceEditionCode?: unknown;
  editions?: unknown;
};

export const EXCEL_COLUMN_ALIASES: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  originaltitle: "originalTitle",
  authors: "authors",
  language: "language",
  description: "description",
  genres: "genres",
  country: "country",
  firstpublishedyear: "firstPublishedYear",
  bookstatus: "bookStatus",
  sourcename: "sourceName",
  sourceurl: "sourceUrl",
  titleoverride: "titleOverride",
  translators: "translators",
  publisher: "publisher",
  isbn10: "isbn10",
  isbn13: "isbn13",
  publishedyear: "publishedYear",
  pagecount: "pageCount",
  coverfilename: "coverFilename",
  coverurl: "coverUrl",
  editiondescription: "editionDescription",
  editionstatus: "editionStatus",
  sourceeditioncode: "sourceEditionCode",
  "عنوان": "title",
  "زیرعنوان": "subtitle",
  "عنواناصلی": "originalTitle",
  "نویسندگان": "authors",
  "زبان": "language",
  "توضیحات": "description",
  "ژانرها": "genres",
  "کشور": "country",
  "سالانتشاراولیه": "firstPublishedYear",
  "وضعیتکتاب": "bookStatus",
  "ناممنبع": "sourceName",
  "لینکمنبع": "sourceUrl",
  "عنواننسخه": "titleOverride",
  "مترجمان": "translators",
  "ناشر": "publisher",
  "شابک۱۰": "isbn10",
  "شابک۱۳": "isbn13",
  "سالچاپ": "publishedYear",
  "تعدادصفحات": "pageCount",
  "نامفایلکاور": "coverFilename",
  "لینککاور": "coverUrl",
  "توضیحاتنسخه": "editionDescription",
  "وضعیتنسخه": "editionStatus",
  "کدنسخهدربع": "sourceEditionCode",
  "کدنسخهدرمنبع": "sourceEditionCode",
};

export function normalizeHeader(header: string): string {
  return header.replace(/\s+/g, "").toLowerCase();
}

export function mapExcelRowKeys(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(row)) {
    const alias = EXCEL_COLUMN_ALIASES[normalizeHeader(key)] ?? key;
    mapped[alias] = value;
  }
  return mapped;
}

export function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const stringValue = String(value)
    .replace(/\u200c|\u200f|\u200e|\ufeff/g, "")
    .trim();
  return stringValue ? stringValue : null;
}

export function splitMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => splitMultiValue(cleanString(item)))
      .filter((item, index, array) => array.indexOf(item) === index);
  }

  return splitMultiValueText(cleanString(value));
}

export function normalizeReferenceValue(
  value: unknown,
): NormalizedImportReference | null {
  const normalized = normalizeReferenceInput(value as ImportReferenceInput);
  if (!normalized) return null;

  return {
    id: normalized.id,
    name: normalized.name,
    originalName: normalized.originalName ?? null,
    slug: normalized.slug ?? null,
    description: normalized.description ?? null,
    imageUrl: normalized.imageUrl ?? null,
    website: normalized.website ?? null,
    sourceName: normalized.sourceName ?? null,
    sourceUrl: normalized.sourceUrl ?? null,
    sourceId: normalized.sourceId ?? null,
    status: normalized.status?.toLowerCase() as ImportStatus | undefined,
  };
}

export function normalizeReferenceArray(value: unknown): NormalizedImportReference[] {
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => {
      if (typeof item === "string") {
        return splitMultiValueText(item)
          .map((part) => normalizeReferenceValue(part))
          .filter((entry): entry is NormalizedImportReference => Boolean(entry));
      }

      const normalized = normalizeReferenceValue(item);
      return normalized ? [normalized] : [];
    });
    return dedupeReferences(items);
  }

  return dedupeReferences(
    splitMultiValue(value)
      .map((item) => normalizeReferenceValue(item))
      .filter((item): item is NormalizedImportReference => Boolean(item)),
  );
}

function dedupeReferences(values: NormalizedImportReference[]): NormalizedImportReference[] {
  const seen = new Set<string>();
  const result: NormalizedImportReference[] = [];
  for (const value of values) {
    const key = value.id ?? value.slug ?? value.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function normalizeStatus(
  value: unknown,
  fallback: ImportStatus,
): ImportStatus {
  const normalized = cleanString(value)?.toLowerCase();
  if (!normalized) return fallback;
  if (["approved", "تأییدشده"].includes(normalized)) return "approved";
  if (["rejected", "ردشده"].includes(normalized)) return "rejected";
  return "pending";
}

export function normalizeYear(value: unknown): number | null {
  const stringValue = cleanString(value);
  if (!stringValue) return null;
  const numberValue = Number(stringValue);
  return Number.isInteger(numberValue) ? numberValue : null;
}

export function normalizePositiveInt(value: unknown): number | null {
  const stringValue = cleanString(value);
  if (!stringValue) return null;
  const numberValue = Number(stringValue);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

export function normalizeIsbn(value: unknown): string | null {
  return normalizeImportIsbn(value);
}

export function canPersistCoverUrl(coverUrl: string | null): boolean {
  return !!coverUrl && isAllowedPersistedImageUrl(coverUrl);
}

export { normalizeBookGroupingKey, normalizeBookTitle } from "@/lib/books/import/title-normalization";

export function joinPeople(values: Array<string | NormalizedImportReference>): string {
  return values
    .map((value) => (typeof value === "string" ? value : value.name))
    .filter(Boolean)
    .join("، ");
}

export function referenceNames(values: NormalizedImportReference[]): string[] {
  return values.map((value) => value.name);
}

export function normalizeFlatRowToBook(
  raw: FlatBookLike,
  rowNumber: number,
): NormalizedImportBook {
  const authors = normalizeReferenceArray(raw.authors);
  const genres = normalizeReferenceArray(raw.genres);
  const defaultStatus = normalizeStatus(raw.status ?? raw.bookStatus, "pending");

  const edition: NormalizedImportEdition = {
    rowNumber,
    titleOverride: cleanString(raw.titleOverride),
    translators: normalizeReferenceArray(raw.translators),
    publisher: normalizeReferenceValue(raw.publisher),
    isbn10: normalizeIsbn(raw.isbn10),
    isbn13: normalizeIsbn(raw.isbn13),
    publishedYear: normalizeYear(raw.publishedYear),
    pageCount: normalizePositiveInt(raw.pageCount),
    coverFilename: cleanString(raw.coverFilename),
    coverUrl: cleanString(raw.coverUrl),
    editionDescription: cleanString(raw.editionDescription),
    status: normalizeStatus(raw.editionStatus, defaultStatus),
    sourceName: cleanString(raw.sourceName) ?? "bulk_import",
    sourceUrl: cleanString(raw.sourceUrl),
    sourceEditionCode: cleanString(raw.sourceEditionCode),
  };

  return {
    rowNumbers: [rowNumber],
    title: cleanString(raw.title) ?? "",
    subtitle: cleanString(raw.subtitle),
    originalTitle: cleanString(raw.originalTitle),
    authors,
    language: cleanString(raw.language) ?? "fa",
    description: cleanString(raw.description),
    genres,
    country: normalizeReferenceValue(raw.country),
    firstPublishedYear: normalizeYear(raw.firstPublishedYear),
    status: defaultStatus,
    sourceName: cleanString(raw.sourceName) ?? "bulk_import",
    sourceUrl: cleanString(raw.sourceUrl),
    editions: [edition],
  };
}

export function normalizeNestedBook(
  raw: FlatBookLike & { editions?: unknown[] },
  rowNumber: number,
): NormalizedImportBook {
  const base = normalizeFlatRowToBook(raw, rowNumber);
  const nestedEditions = Array.isArray(raw.editions) ? raw.editions : [];
  if (nestedEditions.length === 0) return base;

  return {
    ...base,
    editions: nestedEditions.map((edition, index) => {
      const normalized = normalizeFlatRowToBook(
        {
          ...raw,
          ...((edition as Record<string, unknown>) ?? {}),
          status: raw.status ?? raw.bookStatus,
        },
        rowNumber + index,
      ).editions[0];
      return { ...normalized, rowNumber };
    }),
  };
}

export function groupBooks(
  books: NormalizedImportBook[],
): NormalizedImportBook[] {
  const grouped = new Map<string, NormalizedImportBook>();

  for (const book of books) {
    const key = normalizeBookGroupingKey(
      book.title,
      book.authors[0]?.name ?? "",
      book.originalTitle,
    );
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...book,
        rowNumbers: [...book.rowNumbers],
        authors: [...book.authors],
        genres: [...book.genres],
        editions: [...book.editions],
      });
      continue;
    }

    existing.rowNumbers.push(...book.rowNumbers);
    existing.editions.push(...book.editions);
    if (!existing.subtitle && book.subtitle) existing.subtitle = book.subtitle;
    if (!existing.originalTitle && book.originalTitle) {
      existing.originalTitle = book.originalTitle;
    }
    if (!existing.description && book.description) existing.description = book.description;
    if (!existing.country && book.country) existing.country = book.country;
    if (!existing.firstPublishedYear && book.firstPublishedYear) {
      existing.firstPublishedYear = book.firstPublishedYear;
    }
    existing.authors = dedupeReferences([...existing.authors, ...book.authors]);
    existing.genres = dedupeReferences([...existing.genres, ...book.genres]);
  }

  return Array.from(grouped.values());
}
