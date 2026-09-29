import { and, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { BookSearchIndex, CatalogBook, CatalogBookContributor } from "@/db/schema";
import { discoverySignalFields, getDiscoveryCards, publicCatalogBookCondition } from "@/lib/book/discover-service";
import { genresOf, isPublicDiscoveryBook, scoreSimilarity, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
import { compactSearchText, normalizeSearchText } from "@/lib/book/search-normalize";
import { discoveryDay, rankRecommendations, RECOMMENDATION_WEIGHTS } from "@/lib/book/recommendation-ranking";
import { similarBooksById } from "@/lib/book/similar-books-config";

const MAX_SIMILAR_BOOKS = 6;

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
  day = discoveryDay(),
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
    .filter((item) => item.relevanceScore > 0 &&
      (selected.length < 3 || item.score >= RECOMMENDATION_WEIGHTS.similarCuratedFillThreshold));
  const automatic = rankRecommendations(ranked, MAX_SIMILAR_BOOKS - selected.length,
    `${day}:similar:${source.id}`, selected.flatMap((id) => byId.get(id) ?? []));
  return [...selected, ...automatic.map(({ book }) => book.id)];
}

export async function getSimilarBooks(sourceBookId: string): Promise<SimilarBook[]> {
  const [source] = await db.select(discoverySignalFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, eq(CatalogBook.id, sourceBookId))).limit(1);
  if (!source) return [];
  const curated = [...new Set(similarBooksById[sourceBookId] ?? [])].filter((id) => id !== sourceBookId);
  const matches: SQL[] = [];
  if (curated.length) matches.push(inArray(CatalogBook.id, curated));

  const indexedMatches: SQL[] = [];
  if (source.author.trim()) {
    indexedMatches.push(and(
      eq(BookSearchIndex.kind, "AUTHOR"),
      eq(BookSearchIndex.valueCompact, compactSearchText(source.author)),
    )!);
  }
  const genres = genresOf(source).map(normalizeSearchText).filter(Boolean);
  if (genres.length) {
    indexedMatches.push(and(
      eq(BookSearchIndex.kind, "GENRE"),
      or(...genres.map((genre) => like(BookSearchIndex.valueNormalized, `%${genre}%`))),
    )!);
  }
  if (indexedMatches.length) {
    matches.push(inArray(CatalogBook.id, db.select({ id: BookSearchIndex.catalogBookId })
      .from(BookSearchIndex).where(or(...indexedMatches))));
  }
  if (source.contributorIds.length) {
    matches.push(inArray(CatalogBook.id, db.select({ id: CatalogBookContributor.catalogBookId })
      .from(CatalogBookContributor)
      .where(and(
        eq(CatalogBookContributor.role, "AUTHOR"),
        inArray(CatalogBookContributor.referenceItemId, source.contributorIds),
      ))));
  }
  if (!matches.length) return [];

  const candidates = await db.select(discoverySignalFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, or(...matches)));
  const ids = selectSimilarBookIds(source, curated, candidates);
  const cards = await getDiscoveryCards(ids);
  return cards.flatMap((book) => book.slug ? [{ ...book, slug: book.slug }] : []);
}
