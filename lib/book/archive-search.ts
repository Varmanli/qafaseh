// The desktop archive uses a five-column grid, so a full page is a complete
// 5 × 6 set of cards. All archive limit/offset/page-count math derives from
// this single constant.
export const BOOK_ARCHIVE_PAGE_SIZE = 30;

export const BOOK_ARCHIVE_SORT_OPTIONS = [
  { value: "NEWEST", label: "جدیدترین" },
  { value: "OLDEST", label: "قدیمی‌ترین" },
  { value: "TITLE_ASC", label: "عنوان از الف تا ی" },
  { value: "TITLE_DESC", label: "عنوان از ی تا الف" },
  { value: "POPULAR", label: "محبوب‌ترین" },
  { value: "RATING_DESC", label: "بالاترین امتیاز" },
  { value: "PAGES_DESC", label: "بیشترین تعداد صفحه" },
  { value: "PAGES_ASC", label: "کمترین تعداد صفحه" },
] as const;

export type BookArchiveSort = (typeof BOOK_ARCHIVE_SORT_OPTIONS)[number]["value"];
export type BookArchiveCoverFilter = "any" | "with" | "without";

export interface BookArchiveFilters {
  q: string;
  genre: string;
  author: string;
  translator: string;
  publisher: string;
  country: string;
  language: string;
  hasCover: BookArchiveCoverFilter;
  minPages: number | null;
  maxPages: number | null;
  minRating: number | null;
  maxRating: number | null;
  minYear: number | null;
  maxYear: number | null;
  sort: BookArchiveSort;
  page: number;
}

export interface BookArchiveFilterOptions {
  authors: string[];
  genres: string[];
  translators: string[];
  publishers: string[];
  countries: string[];
  languages: string[];
}

export const DEFAULT_BOOK_ARCHIVE_FILTERS: BookArchiveFilters = {
  q: "",
  genre: "",
  author: "",
  translator: "",
  publisher: "",
  country: "",
  language: "",
  hasCover: "any",
  minPages: null,
  maxPages: null,
  minRating: null,
  maxRating: null,
  minYear: null,
  maxYear: null,
  sort: "POPULAR",
  page: 1,
};

type SearchParamValue = string | string[] | undefined;

function firstOf(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseNumber(value: SearchParamValue, min?: number, max?: number) {
  const raw = firstOf(value).trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  let result = Math.trunc(parsed);
  if (typeof min === "number") result = Math.max(min, result);
  if (typeof max === "number") result = Math.min(max, result);
  return result;
}

function normalizeRange(
  minValue: number | null,
  maxValue: number | null,
): [number | null, number | null] {
  if (
    typeof minValue === "number" &&
    typeof maxValue === "number" &&
    minValue > maxValue
  ) {
    return [maxValue, minValue];
  }

  return [minValue, maxValue];
}

export function parseBookArchiveSearchParams(
  searchParams: Record<string, SearchParamValue>,
): BookArchiveFilters {
  const sort = firstOf(searchParams.sort).trim() as BookArchiveSort;
  const hasCover = firstOf(searchParams.cover).trim() as BookArchiveCoverFilter;

  const [minPages, maxPages] = normalizeRange(
    parseNumber(searchParams.minPages, 1),
    parseNumber(searchParams.maxPages, 1),
  );
  const [minRating, maxRating] = normalizeRange(
    parseNumber(searchParams.minRating, 1, 5),
    parseNumber(searchParams.maxRating, 1, 5),
  );
  const [minYear, maxYear] = normalizeRange(
    parseNumber(searchParams.minYear, 0, 3000),
    parseNumber(searchParams.maxYear, 0, 3000),
  );

  return {
    // Preserve the exact query text for the controlled RTL input. Trimming it
    // here feeds a modified value back from the URL and can move the caret or
    // discard characters while a user is typing. `query` is accepted as a
    // shareable URL alias while existing `q` links remain compatible.
    q: firstOf(searchParams.q) || firstOf(searchParams.query),
    genre: firstOf(searchParams.genre).trim(),
    author: firstOf(searchParams.author).trim(),
    translator: firstOf(searchParams.translator).trim(),
    publisher: firstOf(searchParams.publisher).trim(),
    country: firstOf(searchParams.country).trim(),
    language: firstOf(searchParams.language).trim(),
    hasCover:
      hasCover === "with" || hasCover === "without" ? hasCover : "any",
    minPages,
    maxPages,
    minRating,
    maxRating,
    minYear,
    maxYear,
    sort: BOOK_ARCHIVE_SORT_OPTIONS.some((item) => item.value === sort)
      ? sort
      : "POPULAR",
    page: parseNumber(searchParams.page, 1, 9999) ?? 1,
  };
}

export function hasActiveBookArchiveFilters(filters: BookArchiveFilters) {
  return (
    filters.q !== "" ||
    filters.genre !== "" ||
    filters.author !== "" ||
    filters.translator !== "" ||
    filters.publisher !== "" ||
    filters.country !== "" ||
    filters.language !== "" ||
    filters.hasCover !== "any" ||
    filters.minPages !== null ||
    filters.maxPages !== null ||
    filters.minRating !== null ||
    filters.maxRating !== null ||
    filters.minYear !== null ||
    filters.maxYear !== null
  );
}

export function toBookArchiveSearchParams(filters: BookArchiveFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.author) params.set("author", filters.author);
  if (filters.translator) params.set("translator", filters.translator);
  if (filters.publisher) params.set("publisher", filters.publisher);
  if (filters.country) params.set("country", filters.country);
  if (filters.language) params.set("language", filters.language);
  if (filters.hasCover !== "any") params.set("cover", filters.hasCover);
  if (filters.minPages !== null) params.set("minPages", String(filters.minPages));
  if (filters.maxPages !== null) params.set("maxPages", String(filters.maxPages));
  if (filters.minRating !== null)
    params.set("minRating", String(filters.minRating));
  if (filters.maxRating !== null)
    params.set("maxRating", String(filters.maxRating));
  if (filters.minYear !== null) params.set("minYear", String(filters.minYear));
  if (filters.maxYear !== null) params.set("maxYear", String(filters.maxYear));
  if (filters.sort !== "POPULAR") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}
