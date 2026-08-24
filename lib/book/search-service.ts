import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { BookEdition, CatalogBook } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import { ensureCatalogBookSlug } from "@/lib/book/public-slug";
import { compactSearchText, normalizeSearchText } from "@/lib/book/search-normalize";

export interface PublicBookSearchResult {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
  translator: string | null;
  publisher: string | null;
  matchedEditionId: string | null;
  matchedEditionLabel: string | null;
}

type RankedId = { catalogBookId: string; matchedEditionId: string | null; rank: number };

/**
 * Searches the trigger-maintained entries and groups all matching editions back
 * into their canonical book. Exact and prefix matches are deterministic; the
 * trigram branch is only a recall fallback for longer queries.
 */
export async function searchPublicBooks(rawQuery: string, limit = 20): Promise<PublicBookSearchResult[]> {
  const normalized = normalizeSearchText(rawQuery);
  const compact = compactSearchText(rawQuery);
  if (!normalized || !compact) return [];

  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const ranked = await db.execute<RankedId>(sql`
    with candidates as (
      select
        i.catalog_book_id as "catalogBookId",
        i.edition_id as "editionId",
        case
          when i.value_compact = ${compact} and i.kind = 'CANONICAL_TITLE' then 0
          when i.value_compact = ${compact} and i.kind in ('EDITION_TITLE', 'EDITION_LABEL') then 1
          when i.value_compact = ${compact} and i.kind in ('AUTHOR', 'AUTHOR_REFERENCE', 'AUTHOR_ALIAS') then 8
          when i.value_compact = ${compact} then 2
          when i.value_compact like ${`${compact}%`} and i.kind = 'CANONICAL_TITLE' then 3
          when i.value_compact like ${`${compact}%`} and i.kind in ('EDITION_TITLE', 'EDITION_LABEL') then 4
          when i.value_compact like ${`${compact}%`} and i.kind in ('AUTHOR', 'AUTHOR_REFERENCE', 'AUTHOR_ALIAS') then 8
          when i.value_compact like ${`${compact}%`} then 5
          when length(${compact}) >= 4 and i.kind in ('CANONICAL_TITLE', 'EDITION_TITLE', 'EDITION_LABEL') and i.value_compact % ${compact} then 6
          when length(${compact}) >= 4 and i.kind in ('AUTHOR', 'AUTHOR_REFERENCE', 'AUTHOR_ALIAS') and i.value_compact % ${compact} then 8
          when length(${compact}) >= 4 and i.value_compact % ${compact} then 7
          else 99
        end as rank,
        similarity(i.value_compact, ${compact}) as similarity
      from "BookSearchIndex" i
      where i.value_compact = ${compact}
         or i.value_compact like ${`${compact}%`}
         or (length(${compact}) >= 4 and i.value_compact % ${compact})
    ), best as (
      select distinct on ("catalogBookId") "catalogBookId", "editionId" as "matchedEditionId", rank, similarity
      from candidates
      where rank < 99
      order by "catalogBookId", rank asc, similarity desc, "editionId" nulls last
    )
    select "catalogBookId", "matchedEditionId", rank
    from best
    order by rank asc, similarity desc, "catalogBookId"
    limit ${safeLimit}
  `);

  if (ranked.rows.length === 0) return [];
  const ids: string[] = ranked.rows.map((row) => row.catalogBookId);
  const rows = await db
    .select({
      id: CatalogBook.id,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      author: CatalogBook.author,
      translator: preferredEditionFieldSql<string | null>("translator"),
      publisher: preferredEditionFieldSql<string | null>("publisher"),
      coverImage: displayCoverFieldSql(),
    })
    .from(CatalogBook)
    .where(and(eq(CatalogBook.status, "APPROVED"), inArray(CatalogBook.id, ids)));
  const books = new Map(rows.map((row) => [row.id, row]));

  const editionIds: string[] = ranked.rows
    .map((row) => row.matchedEditionId)
    .filter((id): id is string => id !== null);
  const editions = editionIds.length
    ? await db.select({ id: BookEdition.id, titleOverride: BookEdition.titleOverride, editionLabel: BookEdition.editionLabel }).from(BookEdition).where(inArray(BookEdition.id, editionIds))
    : [];
  const editionMap = new Map(editions.map((edition) => [edition.id, edition]));

  return Promise.all(ranked.rows.flatMap(async (rank) => {
    const book = books.get(rank.catalogBookId);
    if (!book) return [];
    const edition = rank.matchedEditionId ? editionMap.get(rank.matchedEditionId) : null;
    return [{
      id: book.id,
      slug: await ensureCatalogBookSlug({ id: book.id, title: book.title, slug: book.slug }),
      title: book.title,
      author: book.author,
      translator: book.translator,
      publisher: book.publisher,
      coverImage: coalesceCoverImage(book.coverImage),
      matchedEditionId: rank.matchedEditionId,
      matchedEditionLabel: edition?.titleOverride || edition?.editionLabel || null,
    }];
  })).then((groups) => groups.flat());
}
