export type PaginationSearchParams =
  | string
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/**
 * Builds an archive URL by changing only its `page` parameter.
 *
 * The record form mirrors Next.js server-component searchParams, while the
 * string form works with `useSearchParams().toString()` in client components.
 */
export function buildPaginationHref(
  pathname: string,
  searchParams: PaginationSearchParams,
  page: number,
) {
  const params = toUrlSearchParams(searchParams);

  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function toUrlSearchParams(searchParams: PaginationSearchParams) {
  if (typeof searchParams === "string") {
    return new URLSearchParams(searchParams);
  }

  if (searchParams instanceof URLSearchParams) {
    return new URLSearchParams(searchParams);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

export type PaginationItem = number | "ellipsis";

export function getPaginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PaginationItem[] {
  const safeTotal = Math.max(1, Math.trunc(totalPages));
  const current = Math.min(safeTotal, Math.max(1, Math.trunc(currentPage)));

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const pages = new Set([1, safeTotal]);
  for (let page = current - siblingCount; page <= current + siblingCount; page += 1) {
    if (page > 1 && page < safeTotal) pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}
