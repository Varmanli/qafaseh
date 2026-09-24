import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook } from "@/db/schema";
import { discoverySignalFields, getDiscoveryCards, publicCatalogBookCondition } from "@/lib/book/discover-service";
import { genresOf, isPublicDiscoveryBook, scoreSimilarity, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
import { similarBooksById } from "@/lib/book/similar-books-config";

const MAX_SIMILAR_BOOKS = 6;
const MAX_RULE_CANDIDATES = 400;

export type SimilarBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
};

export function selectSimilarBookIds(
  source: CatalogDiscoverySignals,
  relatedIds: readonly string[],
  candidates: CatalogDiscoverySignals[],
): string[] {
  if (!isPublicDiscoveryBook(source)) return [];
  const byId = new Map(candidates.filter(isPublicDiscoveryBook).map((book) => [book.id, book]));
  byId.delete(source.id);
  const selected: string[] = [];
  const seen = new Set([source.id]);
  for (const id of relatedIds) {
    if (selected.length === MAX_SIMILAR_BOOKS) return selected;
    if (byId.has(id) && !seen.has(id)) { selected.push(id); seen.add(id); }
  }
  const ranked = [...byId.values()].filter((book) => !seen.has(book.id))
    .map((book) => ({ book, ...scoreSimilarity(source, book) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.book.id.localeCompare(b.book.id));
  let sameAuthorCount = 0;
  while (ranked.length && selected.length < MAX_SIMILAR_BOOKS) {
    const alternative = ranked.findIndex((item) => !item.sameAuthor && item.score >= ranked[0].score - 1);
    const index = sameAuthorCount >= 2 && alternative >= 0 ? alternative : 0;
    const [item] = ranked.splice(index, 1);
    selected.push(item.book.id);
    if (item.sameAuthor) sameAuthorCount++;
  }
  return selected;
}

export async function getSimilarBooks(sourceBookId: string): Promise<SimilarBook[]> {
  const [source] = await db.select(discoverySignalFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, eq(CatalogBook.id, sourceBookId))).limit(1);
  if (!source) return [];
  const curated = [...new Set(similarBooksById[sourceBookId] ?? [])].filter((id) => id !== sourceBookId);
  const genres = genresOf(source);
  const genreMatch = genres.length ? sql`exists (
    select 1 from regexp_split_to_table(coalesce(${CatalogBook.genre}, ''), '[،,;؛•]') as g
    where lower(trim(g)) in (${sql.join(genres.map((genre) => sql`${genre}`), sql`, `)})
  )` : undefined;
  const authorMatch = source.author.trim()
    ? sql`lower(trim(${CatalogBook.author})) = ${source.author.trim().toLocaleLowerCase("fa")}`
    : undefined;
  const contributorMatch = source.contributorIds.length ? sql`exists (
    select 1 from "CatalogBookContributor" c
    where c.catalog_book_id = "CatalogBook"."id" and c.role = 'AUTHOR'
      and c.reference_item_id in (${sql.join(source.contributorIds.map((id) => sql`${id}`), sql`, `)})
  )` : undefined;
  const candidateMatch = or(
    curated.length ? inArray(CatalogBook.id, curated) : undefined,
    genreMatch, authorMatch, contributorMatch,
  );
  if (!candidateMatch) return [];
  const overlapCount = genres.length ? sql`(
    select count(*) from regexp_split_to_table(coalesce(${CatalogBook.genre}, ''), '[،,;؛•]') as g
    where lower(trim(g)) in (${sql.join(genres.map((genre) => sql`${genre}`), sql`, `)})
  )` : sql`case when true then 0 else 0 end`;
  const curatedRank = curated.length
    ? sql`case when ${inArray(CatalogBook.id, curated)} then 1 else 0 end`
    : sql`case when true then 0 else 0 end`;
  // SQL narrows to shared taxonomy/author before loading lightweight signals.
  // The overlap ordering makes the 400-row ceiling favor the strongest matches.
  const rows = await db.select(discoverySignalFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, ne(CatalogBook.id, sourceBookId), candidateMatch))
    .orderBy(sql`${curatedRank} desc`, sql`${overlapCount} desc`,
      sql`case when lower(trim(${CatalogBook.author})) = ${source.author.trim().toLocaleLowerCase("fa")} then 1 else 0 end desc`,
      sql`abs(coalesce(${CatalogBook.firstPublishedYear}, 0) - ${source.firstPublishedYear ?? 0}) asc`, CatalogBook.id)
    .limit(MAX_RULE_CANDIDATES);
  const ids = selectSimilarBookIds(source, curated, rows);
  const cards = await getDiscoveryCards(ids);
  return cards.flatMap((book) => book.slug ? [{ ...book, slug: book.slug }] : []);
}
