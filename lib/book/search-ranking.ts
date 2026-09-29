import { compactSearchText } from "@/lib/book/search-normalize";
import { sql, type SQL } from "drizzle-orm";

export type SearchEntryKind = "CANONICAL_TITLE" | "ORIGINAL_TITLE" | "EDITION_TITLE" | "EDITION_LABEL" | "AUTHOR" | "AUTHOR_REFERENCE" | "AUTHOR_ALIAS" | "TRANSLATOR" | "TRANSLATOR_REFERENCE" | "TRANSLATOR_ALIAS" | "PUBLISHER" | "PUBLISHER_REFERENCE" | "GENRE" | "ISBN" | "METADATA";

/** Shared by the archive and the typeahead search before either paginates. */
export function searchMatchSql(query: string, value: SQL) {
  const contains = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  return sql`(${value} like ${contains} or (length(${query}) >= 4 and ${value} % ${query}))`;
}

export function searchRankSql(query: string, value: SQL, kind: SQL): SQL<number> {
  const title = sql`${kind} in ('CANONICAL_TITLE', 'ORIGINAL_TITLE', 'EDITION_TITLE', 'EDITION_LABEL')`;
  const author = sql`${kind} in ('AUTHOR', 'AUTHOR_REFERENCE', 'AUTHOR_ALIAS')`;
  const translator = sql`${kind} in ('TRANSLATOR', 'TRANSLATOR_REFERENCE', 'TRANSLATOR_ALIAS')`;
  const publisher = sql`${kind} in ('PUBLISHER', 'PUBLISHER_REFERENCE')`;
  return sql<number>`case
    when ${value} = ${query} and ${kind} = 'CANONICAL_TITLE' then 0
    when ${value} = ${query} and ${title} then 1
    when strpos(${value}, ${query}) = 1 and ${kind} = 'CANONICAL_TITLE' then 2
    when strpos(${value}, ${query}) = 1 and ${title} then 3
    when strpos(${value}, ${query}) > 0 and ${kind} = 'CANONICAL_TITLE' then 4
    when strpos(${value}, ${query}) > 0 and ${title} then 5
    when ${value} = ${query} and ${author} then 6
    when strpos(${value}, ${query}) = 1 and ${author} then 7
    when strpos(${value}, ${query}) > 0 and ${author} then 8
    when ${value} = ${query} and ${translator} then 9
    when strpos(${value}, ${query}) = 1 and ${translator} then 10
    when strpos(${value}, ${query}) > 0 and ${translator} then 11
    when ${value} = ${query} and ${publisher} then 12
    when strpos(${value}, ${query}) = 1 and ${publisher} then 13
    when strpos(${value}, ${query}) > 0 and ${publisher} then 14
    when ${value} = ${query} then 15
    when strpos(${value}, ${query}) = 1 then 16
    when strpos(${value}, ${query}) > 0 then 17
    when ${title} then 18
    when ${author} then 19
    else 20 end`;
}

/** Mirrors the deterministic substring portion of the SQL ranking contract. */
export function deterministicSearchRank(query: string, value: string, kind: SearchEntryKind): number | null {
  const needle = compactSearchText(query);
  const candidate = compactSearchText(value);
  if (!needle || !candidate) return null;
  const title = ["CANONICAL_TITLE", "ORIGINAL_TITLE", "EDITION_TITLE", "EDITION_LABEL"].includes(kind);
  const author = ["AUTHOR", "AUTHOR_REFERENCE", "AUTHOR_ALIAS"].includes(kind);
  const translator = ["TRANSLATOR", "TRANSLATOR_REFERENCE", "TRANSLATOR_ALIAS"].includes(kind);
  const publisher = ["PUBLISHER", "PUBLISHER_REFERENCE"].includes(kind);
  const match = candidate === needle ? 0 : candidate.startsWith(needle) ? 1 : candidate.includes(needle) ? 2 : -1;
  if (match < 0) return null;
  if (kind === "CANONICAL_TITLE") return [0, 2, 4][match];
  if (title) return [1, 3, 5][match];
  if (author) return [6, 7, 8][match];
  if (translator) return [9, 10, 11][match];
  if (publisher) return [12, 13, 14][match];
  return [15, 16, 17][match];
}
