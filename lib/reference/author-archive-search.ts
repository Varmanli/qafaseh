export const AUTHOR_ARCHIVE_PAGE_SIZE = 20;

export const AUTHOR_ARCHIVE_SORT_OPTIONS = [
  { value: "TOP", label: "برترین" },
  { value: "MOST_BOOKS", label: "بیشترین کتاب" },
  { value: "HIGHEST_RATED", label: "بالاترین امتیاز" },
  { value: "MOST_POPULAR", label: "محبوب‌ترین" },
  { value: "NEWEST", label: "جدیدترین" },
  { value: "OLDEST", label: "قدیمی‌ترین" },
  { value: "NAME_ASC", label: "الفبا: الف تا ی" },
  { value: "NAME_DESC", label: "الفبا: ی تا الف" },
] as const;

export type AuthorArchiveSort = (typeof AUTHOR_ARCHIVE_SORT_OPTIONS)[number]["value"];

export interface AuthorArchiveFilters {
  q: string;
  country: string;
  minBooks: number | null;
  minRating: number | null;
  sort: AuthorArchiveSort;
  page: number;
}

type SearchParamValue = string | string[] | undefined;
const firstOf = (value: SearchParamValue) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

function numberParam(value: SearchParamValue, min: number, max: number) {
  const parsed = Number(firstOf(value).trim());
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : null;
}

export const DEFAULT_AUTHOR_ARCHIVE_FILTERS: AuthorArchiveFilters = {
  q: "", country: "", minBooks: null, minRating: null, sort: "TOP", page: 1,
};

export function parseAuthorArchiveSearchParams(params: Record<string, SearchParamValue>): AuthorArchiveFilters {
  const sort = firstOf(params.sort).trim() as AuthorArchiveSort;
  const minBooks = numberParam(params.minBooks, 1, 100000);
  const rawRating = Number(firstOf(params.minRating).trim());
  return {
    q: firstOf(params.q),
    country: firstOf(params.country).trim(),
    minBooks: [5, 10, 20].includes(minBooks ?? 0) ? minBooks : null,
    minRating: [3, 4, 4.5].includes(rawRating) ? rawRating : null,
    sort: AUTHOR_ARCHIVE_SORT_OPTIONS.some((item) => item.value === sort) ? sort : "TOP",
    page: numberParam(params.page, 1, 9999) ?? 1,
  };
}

export function toAuthorArchiveSearchParams(filters: AuthorArchiveFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.country) params.set("country", filters.country);
  if (filters.minBooks) params.set("minBooks", String(filters.minBooks));
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.sort !== "TOP") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function hasActiveAuthorArchiveFilters(filters: AuthorArchiveFilters) {
  return Boolean(filters.country || filters.minBooks || filters.minRating);
}

/** A search URL update is only needed after the user actually changes its text. */
export function hasAuthorArchiveSearchChanged(
  filters: Pick<AuthorArchiveFilters, "q">,
  query: string,
) {
  return filters.q !== query;
}
