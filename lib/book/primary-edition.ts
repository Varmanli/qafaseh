import { asc, desc, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { BookEdition, CatalogBook } from "@/db/schema";

type EditionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DisplayEditionCandidate {
  id: string;
  status?: EditionStatus | null;
  coverImage?: string | null;
  publisher?: string | null;
  translator?: string | null;
  isbn?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  createdAt?: Date | null;
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function completenessScore(edition: DisplayEditionCandidate) {
  return (
    Number(hasText(edition.publisher)) +
    Number(hasText(edition.translator)) +
    Number(hasText(edition.isbn13) || hasText(edition.isbn10) || hasText(edition.isbn))
  );
}

function fallbackRank(edition: DisplayEditionCandidate, index: number) {
  return {
    index,
    approved: edition.status === "APPROVED" ? 0 : 1,
    hasCover: hasText(edition.coverImage) ? 0 : 1,
    completeness: -completenessScore(edition),
    createdAt: edition.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
  };
}

export function resolveDisplayEdition<T extends DisplayEditionCandidate>(
  primaryEditionId: string | null | undefined,
  editions: T[],
): T | null {
  if (editions.length === 0) return null;

  if (primaryEditionId) {
    const primary = editions.find((edition) => edition.id === primaryEditionId);
    if (primary) return primary;
  }

  return editions
    .map((edition, index) => ({ edition, rank: fallbackRank(edition, index) }))
    .sort((a, b) => {
      if (a.rank.approved !== b.rank.approved) {
        return a.rank.approved - b.rank.approved;
      }
      if (a.rank.hasCover !== b.rank.hasCover) {
        return a.rank.hasCover - b.rank.hasCover;
      }
      if (a.rank.completeness !== b.rank.completeness) {
        return a.rank.completeness - b.rank.completeness;
      }
      if (a.rank.createdAt !== b.rank.createdAt) {
        return a.rank.createdAt - b.rank.createdAt;
      }
      return a.rank.index - b.rank.index;
    })[0]?.edition ?? null;
}

export function primaryEditionOrderBy(
  primaryEditionId: SQLWrapper,
  table: typeof BookEdition = BookEdition,
) {
  const publisherPresent = sql`case when ${table.publisher} is not null and trim(${table.publisher}) <> '' then 1 else 0 end`;
  const translatorPresent = sql`case when ${table.translator} is not null and trim(${table.translator}) <> '' then 1 else 0 end`;
  const isbnPresent = sql`case when coalesce(${table.isbn13}, ${table.isbn10}, ${table.isbn}) is not null and trim(coalesce(${table.isbn13}, ${table.isbn10}, ${table.isbn})) <> '' then 1 else 0 end`;
  const completeness = sql`${publisherPresent} + ${translatorPresent} + ${isbnPresent}`;

  return [
    asc(sql`case when ${primaryEditionId} is not null and ${table.id} = ${primaryEditionId} then 0 else 1 end`),
    asc(sql`case when ${table.status} = 'APPROVED' then 0 else 1 end`),
    asc(sql`case when ${table.coverImage} is not null and trim(${table.coverImage}) <> '' then 0 else 1 end`),
    desc(completeness),
    asc(table.createdAt),
    asc(table.id),
  ] as const;
}

const ALLOWED_EDITION_COLUMNS = new Set([
  "id",
  "catalog_book_id",
  "status",
  "cover_image",
  "edition_label",
  "publisher",
  "translator",
  "isbn",
  "isbn10",
  "isbn13",
  "page_count",
  "publish_year",
  "price",
  "created_at",
  "updated_at",
]);

export function preferredEditionFieldSql<T>(
  fieldName: string,
  {
    catalogBookId = CatalogBook.id,
    primaryEditionId = CatalogBook.primaryEditionId,
    approvedOnly = true,
  }: {
    catalogBookId?: SQLWrapper;
    primaryEditionId?: SQLWrapper;
    approvedOnly?: boolean;
  } = {},
): SQL<T> {
  const normalized = fieldName.trim().toLowerCase();
  if (!ALLOWED_EDITION_COLUMNS.has(normalized)) {
    throw new Error(`Disallowed column identifier for edition subquery: ${fieldName}`);
  }

  const approvedClause = approvedOnly ? sql`and be.status = 'APPROVED'` : sql``;

  return sql<T>`(
    select be.${sql.identifier(normalized)}
    from "BookEdition" be
    where be.catalog_book_id = ${catalogBookId}
      ${approvedClause}
    order by
      case when ${primaryEditionId} is not null and be.id = ${primaryEditionId} then 0 else 1 end,
      case when be.status = 'APPROVED' then 0 else 1 end,
      case when be.cover_image is not null and trim(be.cover_image) <> '' then 0 else 1 end,
      (
        case when be.publisher is not null and trim(be.publisher) <> '' then 1 else 0 end +
        case when be.translator is not null and trim(be.translator) <> '' then 1 else 0 end +
        case when coalesce(be.isbn13, be.isbn10, be.isbn) is not null and trim(coalesce(be.isbn13, be.isbn10, be.isbn)) <> '' then 1 else 0 end
      ) desc,
      be.created_at asc,
      be.id asc
    limit 1
  )`;
}

