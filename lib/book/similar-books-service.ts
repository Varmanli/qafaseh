import { getCatalogDiscoverySignals, getDiscoveryCards } from "@/lib/book/discover-service";
import { isPublicDiscoveryBook, scoreSimilarity, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
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
  // ponytail: one lightweight keyset scan is exact for this small catalog;
  // add an indexed taxonomy candidate query if signal scans become expensive.
  const rows = await getCatalogDiscoverySignals();
  const source = rows.find((book) => book.id === sourceBookId);
  if (!source) return [];
  const curated = [...new Set(similarBooksById[sourceBookId] ?? [])].filter((id) => id !== sourceBookId);
  const ids = selectSimilarBookIds(source, curated, rows);
  const cards = await getDiscoveryCards(ids);
  return cards.flatMap((book) => book.slug ? [{ ...book, slug: book.slug }] : []);
}
