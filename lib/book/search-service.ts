import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { BookEdition, CatalogBook } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import { ensureCatalogBookSlug } from "@/lib/book/public-slug";
import { compactSearchText, normalizeSearchText } from "@/lib/book/search-normalize";
import { searchMatchSql, searchRankSql } from "@/lib/book/search-ranking";

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
        ${searchRankSql(compact, sql`i.value_compact`, sql`i.kind`)} as rank,
        similarity(i.value_compact, ${compact}) as similarity
      from "BookSearchIndex" i
      where ${searchMatchSql(compact, sql`i.value_compact`)}
    ), best as (
      select distinct on ("catalogBookId") "catalogBookId", "editionId" as "matchedEditionId", rank, similarity
      from candidates
      order by "catalogBookId", rank asc, similarity desc, "editionId" nulls last
    )
    select best."catalogBookId", best."matchedEditionId", best.rank
    from best
    join "CatalogBook" c on c.id = best."catalogBookId" and c.status = 'APPROVED'
    order by best.rank asc, best.similarity desc, c.created_at desc, best."catalogBookId"
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
