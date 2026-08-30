type SearchParamValue = string | string[] | undefined;

function firstOf(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

/** Returns a safe authors-archive URL or null for any other destination. */
export function getSafeAuthorArchiveReturnPath(value: SearchParamValue) {
  const path = firstOf(value)?.trim();
  if (!path || path.includes("\\") || (!path.startsWith("/authors") || path.startsWith("//"))) {
    return null;
  }

  const parsed = new URL(path, "https://qafaseh.local");
  if (parsed.pathname !== "/authors") return null;

  return `${parsed.pathname}${parsed.search}`;
}

/** Adds the exact current archive URL as a safe, URL-encoded profile return target. */
export function buildAuthorProfileHref(authorSlug: string, archiveSearchParams: string) {
  const params = new URLSearchParams(archiveSearchParams);
  // `from` is navigation metadata rather than archive state; never nest it.
  params.delete("from");
  const archiveQuery = params.toString();
  const returnPath = archiveQuery ? `/authors?${archiveQuery}` : "/authors";

  return `/authors/${encodeURIComponent(authorSlug)}?from=${encodeURIComponent(returnPath)}`;
}
