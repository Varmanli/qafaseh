import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { Book, CatalogBook } from "@/db/schema";
import {
  coalesceCoverImage,
  getEditionCoverSrc,
  type EditionCoverLike,
} from "@/lib/book/cover";
import {
  preferredEditionFieldSql,
  resolveDisplayEdition,
  type DisplayEditionCandidate,
} from "@/lib/book/primary-edition";

export interface DisplayBookEdition extends DisplayEditionCandidate, EditionCoverLike {
  titleOverride?: string | null;
  editionLabel?: string | null;
  subtitle?: string | null;
  author?: string | null;
  publisher?: string | null;
  translator?: string | null;
}

export interface ResolveEditionCoverInput<T extends EditionCoverLike> {
  selectedEdition?: T | null;
  primaryEdition?: T | null;
  fallbackEdition?: T | null;
  catalogBookCover?: string | null;
  legacyBookCover?: string | null;
}

export interface ResolveBookDisplayDataInput<T extends DisplayBookEdition> {
  title: string;
  subtitle?: string | null;
  author: string;
  editions: T[];
  primaryEditionId?: string | null;
  selectedEditionId?: string | null;
  catalogBookCover?: string | null;
  legacyBookCover?: string | null;
}

export function resolveEditionCover<T extends EditionCoverLike>({
  selectedEdition,
  primaryEdition,
  fallbackEdition,
  catalogBookCover,
  legacyBookCover,
}: ResolveEditionCoverInput<T>): string | null {
  return coalesceCoverImage(
    selectedEdition?.coverImage,
    selectedEdition?.coverUrl,
    primaryEdition?.coverImage,
    primaryEdition?.coverUrl,
    fallbackEdition?.coverImage,
    fallbackEdition?.coverUrl,
    catalogBookCover,
    legacyBookCover,
  );
}

export function resolveBookDisplayData<T extends DisplayBookEdition>({
  title,
  subtitle = null,
  author,
  editions,
  primaryEditionId,
  selectedEditionId,
  catalogBookCover,
  legacyBookCover,
}: ResolveBookDisplayDataInput<T>) {
  const primaryEdition = resolveDisplayEdition(primaryEditionId, editions);
  const selectedEdition =
    editions.find((edition) => edition.id === selectedEditionId) ?? primaryEdition;
  const fallbackEdition =
    editions.find((edition) => edition.id !== selectedEdition?.id) ??
    primaryEdition;

  const displayCoverImage = resolveEditionCover({
    selectedEdition,
    primaryEdition,
    fallbackEdition,
    catalogBookCover,
    legacyBookCover,
  });

  return {
    displayEdition: selectedEdition ?? null,
    displayEditionId: selectedEdition?.id ?? null,
    primaryEdition,
    fallbackEdition,
    displayCoverImage,
    coverImage: displayCoverImage,
    title: selectedEdition?.titleOverride?.trim() || title,
    subtitle: selectedEdition?.subtitle?.trim() || subtitle,
    author: selectedEdition?.author?.trim() || author,
    publisher: selectedEdition?.publisher?.trim() || null,
    translator: selectedEdition?.translator?.trim() || null,
    isbn:
      selectedEdition?.isbn13?.trim() ||
      selectedEdition?.isbn10?.trim() ||
      selectedEdition?.isbn?.trim() ||
      null,
    isPrimaryEdition: Boolean(selectedEdition && primaryEdition && selectedEdition.id === primaryEdition.id),
  };
}

const ALLOWED_BOOK_COLUMNS = new Set([
  "id",
  "title",
  "author",
  "translator",
  "publisher",
  "cover_image",
  "description",
  "country",
  "genre",
  "page_count",
  "format",
  "status",
  "created_at",
  "updated_at",
]);

export function sampleLegacyBookFieldSql<T>(
  fieldName: string,
  {
    catalogBookId = CatalogBook.id,
  }: {
    catalogBookId?: SQLWrapper;
  } = {},
): SQL<T> {
  const normalized = fieldName.trim().toLowerCase();
  if (!ALLOWED_BOOK_COLUMNS.has(normalized)) {
    throw new Error(`Disallowed column identifier for legacy book subquery: ${fieldName}`);
  }

  return sql<T>`(
    select b.${sql.identifier(normalized)}
    from "Book" b
    where b.catalog_book_id = ${catalogBookId}
      and b.${sql.identifier(normalized)} is not null
      and trim(b.${sql.identifier(normalized)}) <> ''
    order by
      (b.slug is not null) desc,
      b.created_at desc,
      b.id asc
    limit 1
  )`;
}

export function displayCoverFieldSql({
  catalogBookId = CatalogBook.id,
  primaryEditionId = CatalogBook.primaryEditionId,
  catalogBookCover = CatalogBook.coverImage,
  legacyBookCover,
  approvedOnly = true,
}: {
  catalogBookId?: SQLWrapper;
  primaryEditionId?: SQLWrapper;
  catalogBookCover?: SQLWrapper;
  legacyBookCover?: SQLWrapper;
  approvedOnly?: boolean;
} = {}): SQL<string | null> {
  const preferredEditionCover = preferredEditionFieldSql<string | null>("cover_image", {
    catalogBookId,
    primaryEditionId,
    approvedOnly,
  });

  return sql<string | null>`coalesce(
    nullif(trim(${preferredEditionCover}), ''),
    ${catalogBookCover},
    ${legacyBookCover ?? sampleLegacyBookFieldSql<string | null>("cover_image", { catalogBookId })}
  )`;
}

export function resolveLegacyAwareEditionCover(
  edition?: EditionCoverLike | null,
  catalogBookCover?: string | null,
  legacyBookCover?: string | null,
) {
  return getEditionCoverSrc(edition, catalogBookCover, legacyBookCover);
}
