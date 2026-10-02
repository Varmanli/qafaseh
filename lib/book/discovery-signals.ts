import { splitStoredGenres } from "@/lib/book/genres";
import type { DiscoveryCollection } from "@/lib/book/discover-config";
import { discoveryDay, distinctiveGenres, isBroadGenre, rankRecommendations, RECOMMENDATION_WEIGHTS } from "@/lib/book/recommendation-ranking";
import { normalizeSearchText } from "@/lib/book/search-normalize";
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
  description?: string | null;
  hasCover?: boolean;
  status?: string;
  visibility?: string;
};

export function isPublicDiscoveryBook(book: CatalogDiscoverySignals): book is CatalogDiscoverySignals & { slug: string } {
  return Boolean(book.id && book.slug?.trim() && book.title.trim() &&
    !book.title.startsWith("[TEST:") && (!book.status || book.status === "APPROVED") &&
    (!book.visibility || book.visibility === "PUBLIC"));
}

export function genresOf(book: Pick<CatalogDiscoverySignals, "genre">): string[] {
  return splitStoredGenres(book.genre).map(normalizeSearchText);
}

const bookSignals = new WeakMap<CatalogDiscoverySignals, { genres: Set<string>; text: string }>();
const collectionSignals = new WeakMap<DiscoveryCollection, {
  genres: string[]; terms: string[]; excludedGenres: string[]; excludedTerms: string[];
}>();

function descriptionHasTerm(text: string, term: string) {
  const phrase = ` ${term} `;
  let offset = text.indexOf(phrase);
  while (offset !== -1) {
    const before = text.slice(Math.max(0, offset - 20), offset);
    const after = text.slice(offset + phrase.length);
    if (!/(?:^|\s)(?:بدون|فاقد|نه)\s*$/.test(before) && !/^(?:نیست|نیستند|نبوده|ندارد)(?:\s|$)/.test(after)) return true;
    offset = text.indexOf(phrase, offset + 1);
  }
  return false;
}

export function scoreCollection(book: CatalogDiscoverySignals, collection: DiscoveryCollection) {
  let signals = bookSignals.get(book);
  if (!signals) {
    signals = { genres: new Set(genresOf(book)), text: ` ${normalizeSearchText((book.description ?? "").replace(/<[^>]*>/g, " "))} ` };
    bookSignals.set(book, signals);
  }
  let profile = collectionSignals.get(collection);
  if (!profile) {
    profile = { genres: collection.genres.map(normalizeSearchText),
      terms: [...new Set((collection.descriptionTerms ?? []).map(normalizeSearchText))],
      excludedGenres: (collection.excludedGenres ?? []).map(normalizeSearchText),
      excludedTerms: (collection.excludedDescriptionTerms ?? []).map(normalizeSearchText) };
    collectionSignals.set(collection, profile);
  }
  const genreMatches = (expected: string) => [...signals.genres].some((genre) => genre === expected || genre.startsWith(`${expected} `));
  const matched = profile.genres.filter(genreMatches);
  // Whole phrases in the actual description, never guesses from a title or author.
  const matchedTerms = profile.terms.filter((term) => descriptionHasTerm(signals.text, term));
  const conflict = profile.excludedGenres.some(genreMatches) ||
    profile.excludedTerms.some((term) => descriptionHasTerm(signals.text, term));
  const metadataScore = matched.some((genre) => !isBroadGenre(genre))
    ? RECOMMENDATION_WEIGHTS.specificGenre
    : matched.length ? RECOMMENDATION_WEIGHTS.broadGenre : 0;
  const editorialScore = book.slug && collection.editorialBookSlugs?.includes(book.slug) ? RECOMMENDATION_WEIGHTS.editorial : 0;
  // Repetition of the same keyword cannot increase confidence.
  const semanticScore = matchedTerms.length ? 2 + Math.min(matchedTerms.length, 2) * 0.5 : 0;
  return { metadataScore, semanticScore, editorialScore, matchedGenres: matched, matchedTerms, conflict,
    score: conflict ? 0 : metadataScore + semanticScore + editorialScore };
}

export function uniqueDiscoveryBooks(candidates: CatalogDiscoverySignals[], excludedIds: readonly string[] = []) {
  const excluded = new Set(excludedIds);
  const seenIds = new Set<string>();
  const seenWorks = new Set<string>();
  return candidates.filter(isPublicDiscoveryBook).filter((book) => !excluded.has(book.id))
    .sort((a, b) => discoveryQuality(b) - discoveryQuality(a) || a.id.localeCompare(b.id))
    .filter((book) => {
      const work = `${normalizeSearchText(book.title)}:${normalizeSearchText(book.author)}`;
      if (seenIds.has(book.id) || seenWorks.has(work)) return false;
      seenIds.add(book.id); seenWorks.add(work);
      return true;
    });
}

export function discoveryQuality(book: CatalogDiscoverySignals) {
  return Number(Boolean(book.hasCover)) * 0.15 + Number(Boolean(book.description?.trim())) * 0.1 +
    Number(commitmentOf(book.pageCount) !== null) * 0.1;
}

export function collectionReason(book: CatalogDiscoverySignals, collection: DiscoveryCollection) {
  const match = scoreCollection(book, collection);
  if (match.conflict || !match.score) return null;
  if (match.matchedGenres.length) return `گونه: ${match.matchedGenres.slice(0, 2).join(" و ")}`;
  if (match.matchedTerms.length) return `در معرفی کتاب: ${match.matchedTerms.slice(0, 2).join("، ")}`;
  return "از انتخاب‌های قفسه برای این حال‌وهوا یا موضوع";
}

export function selectCollectionBooks(candidates: CatalogDiscoverySignals[], collection: DiscoveryCollection, limit = 20, day = discoveryDay()) {
  const scored = uniqueDiscoveryBooks(candidates)
    .map((book) => ({ book, score: scoreCollection(book, collection).score, reason: collectionReason(book, collection) }))
    .filter(({ score }) => score > 0);
  return rankRecommendations(scored.map((item) => ({ ...item, score: item.score + discoveryQuality(item.book) })),
    limit, `${day}:collection:${collection.slug}`).map(({ book, reason }) => ({ id: book.id, reason }));
}

export function selectDiscoveryIds(candidates: CatalogDiscoverySignals[], collection: DiscoveryCollection, limit = 20, day = discoveryDay()): string[] {
  return selectCollectionBooks(candidates, collection, limit, day).map(({ id }) => id);
}

// Stable reader-facing lengths, independent of the size or skew of the catalog.
export const PAGE_BOUNDARIES = { short: 200, medium: 400 } as const;
export function commitmentOf(pageCount: number | null): "short" | "medium" | "long" | null {
  if (!pageCount || !Number.isFinite(pageCount) || pageCount <= 0) return null;
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
