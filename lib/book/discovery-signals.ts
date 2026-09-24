import { splitStoredGenres } from "@/lib/book/genres";
import type { DiscoveryCollection } from "@/lib/book/discover-config";
import { discoveryDay, distinctiveGenres, isBroadGenre, rankRecommendations, RECOMMENDATION_WEIGHTS } from "@/lib/book/recommendation-ranking";
export { distinctiveGenres } from "@/lib/book/recommendation-ranking";

// One canonical catalog work per row. Edition length is optional; there is no
// book-level category, topic, rating, or public visibility column in the schema.
export type CatalogDiscoverySignals = {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  contributorIds: string[];
  genre: string | null;
  country: string | null;
  language: string | null;
  firstPublishedYear: number | null;
  pageCount: number | null;
  status?: string;
  visibility?: string;
};

export function isPublicDiscoveryBook(book: CatalogDiscoverySignals): book is CatalogDiscoverySignals & { slug: string } {
  return Boolean(book.id && book.slug?.trim() && book.title.trim() &&
    !book.title.startsWith("[TEST:") && (!book.status || book.status === "APPROVED") &&
    (!book.visibility || book.visibility === "PUBLIC"));
}

export function genresOf(book: Pick<CatalogDiscoverySignals, "genre">): string[] {
  return splitStoredGenres(book.genre).map((genre) => genre.toLocaleLowerCase("fa"));
}

export function scoreCollection(book: CatalogDiscoverySignals, collection: DiscoveryCollection) {
  const genres = new Set(genresOf(book));
  const matched = collection.genres.filter((genre) => genres.has(genre.toLocaleLowerCase("fa")));
  const metadataScore = matched.some((genre) => !isBroadGenre(genre))
    ? RECOMMENDATION_WEIGHTS.specificGenre
    : matched.length ? RECOMMENDATION_WEIGHTS.broadGenre : 0;
  const editorialScore = book.slug && collection.editorialBookSlugs?.includes(book.slug) ? RECOMMENDATION_WEIGHTS.editorial : 0;
  return { metadataScore, editorialScore, score: metadataScore + editorialScore };
}

export function selectDiscoveryIds(candidates: CatalogDiscoverySignals[], collection: DiscoveryCollection, limit = 20, day = discoveryDay()): string[] {
  const scored = candidates.filter(isPublicDiscoveryBook)
    .map((book) => ({ book, score: scoreCollection(book, collection).score }))
    .filter(({ score }) => score > 0);
  return rankRecommendations(scored, limit, `${day}:collection:${collection.slug}`).map(({ book }) => book.id);
}

// Edition page-count tertiles from the audited seed catalog. Missing stays unknown.
export const PAGE_BOUNDARIES = { short: 323, medium: 415 } as const;
export function commitmentOf(pageCount: number | null): "short" | "medium" | "long" | null {
  if (!pageCount || pageCount <= 0) return null;
  if (pageCount <= PAGE_BOUNDARIES.short) return "short";
  if (pageCount <= PAGE_BOUNDARIES.medium) return "medium";
  return "long";
}

export function scoreSimilarity(source: CatalogDiscoverySignals, candidate: CatalogDiscoverySignals) {
  const sourceGenres = distinctiveGenres(source);
  const targetGenres = new Set(distinctiveGenres(candidate));
  const sharedDistinctive = sourceGenres.filter((genre) => targetGenres.has(genre)).length;
  const sharedAny = genresOf(source).some((genre) => genresOf(candidate).includes(genre));
  const sameAuthor = source.contributorIds.some((id) => candidate.contributorIds.includes(id)) ||
    Boolean(source.author.trim() && source.author.trim().toLocaleLowerCase("fa") === candidate.author.trim().toLocaleLowerCase("fa"));
  const sameCountry = Boolean(source.country && candidate.country && source.country === candidate.country);
  const closeEra = Boolean(source.firstPublishedYear && candidate.firstPublishedYear && Math.abs(source.firstPublishedYear - candidate.firstPublishedYear) <= 15);
  const closeLength = Boolean(source.pageCount && candidate.pageCount && Math.abs(source.pageCount - candidate.pageCount) <= 80);
  // Context never creates a match by itself. Shared narrow taxonomy dominates.
  const relevanceScore = Math.min(sharedDistinctive, 2) * RECOMMENDATION_WEIGHTS.similarSharedSpecificGenre +
    Number(sameAuthor) * RECOMMENDATION_WEIGHTS.similarSameAuthor +
    Number(sharedAny && !sharedDistinctive && (sameCountry || closeEra)) * RECOMMENDATION_WEIGHTS.similarSharedBroadGenre;
  const qualityTieBreakScore = relevanceScore ? Number(sameCountry) * RECOMMENDATION_WEIGHTS.similarSameCountry +
    Number(closeEra) * RECOMMENDATION_WEIGHTS.similarCloseEra +
    Number(closeLength) * RECOMMENDATION_WEIGHTS.similarCloseLength : 0;
  return { score: relevanceScore + qualityTieBreakScore, relevanceScore, qualityTieBreakScore, sameAuthor };
}
