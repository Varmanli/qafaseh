import { compactSearchText } from "@/lib/book/search-normalize";

export type SearchEntryKind = "CANONICAL_TITLE" | "EDITION_TITLE" | "EDITION_LABEL" | "METADATA" | "AUTHOR";

/** Mirrors the deterministic exact/prefix portion of the SQL ranking contract. */
export function deterministicSearchRank(query: string, value: string, kind: SearchEntryKind): number | null {
  const needle = compactSearchText(query);
  const candidate = compactSearchText(value);
  if (!needle || !candidate) return null;
  if (candidate === needle) {
    if (kind === "CANONICAL_TITLE") return 0;
    if (kind === "EDITION_TITLE" || kind === "EDITION_LABEL") return 1;
    return 2;
  }
  if (candidate.startsWith(needle)) {
    if (kind === "CANONICAL_TITLE") return 3;
    if (kind === "EDITION_TITLE" || kind === "EDITION_LABEL") return 4;
    return 5;
  }
  return null;
}
