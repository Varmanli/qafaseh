import { splitStoredGenres } from "@/lib/book/genres";
import type { DiscoveryCollection } from "@/lib/book/discover-config";

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
  const metadataScore = collection.genres.some((genre) => genres.has(genre.toLocaleLowerCase("fa"))) ? 4 : 0;
  const editorialScore = book.slug && collection.editorialBookSlugs?.includes(book.slug) ? 2 : 0;
  return { metadataScore, editorialScore, score: metadataScore + editorialScore };
}

export function selectDiscoveryIds(candidates: CatalogDiscoverySignals[], collection: DiscoveryCollection, limit = 20): string[] {
  return candidates.filter(isPublicDiscoveryBook)
    .map((book) => ({ book, score: scoreCollection(book, collection).score }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.book.id.localeCompare(b.book.id))
    .slice(0, limit).map(({ book }) => book.id);
}

// Canonical-book page-count tertiles: 323 and 415 (49 of 230 local works have
// an approved edition with length, audited 2026-09-24). Missing gets no score.
export const PAGE_BOUNDARIES = { short: 323, medium: 415 } as const;
export function commitmentOf(pageCount: number | null): "short" | "medium" | "long" | null {
  if (!pageCount || pageCount <= 0) return null;
  if (pageCount <= PAGE_BOUNDARIES.short) return "short";
  if (pageCount <= PAGE_BOUNDARIES.medium) return "medium";
  return "long";
}

const BROAD_GENRES = new Set(["داستان", "ادبیات", "ادبیات داستانی", "ادبیات معاصر", "رمان"]);
export function distinctiveGenres(book: CatalogDiscoverySignals): string[] {
  return genresOf(book).filter((genre) => !BROAD_GENRES.has(genre) && !genre.startsWith("دهه ") && !genre.startsWith("ادبیات آمریکا") && !genre.startsWith("ادبیات انگلیس"));
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
  // Meaningful identity/taxonomy dominate. Era/length only sort close matches.
  return { score: sharedDistinctive * 5 + Number(sameAuthor) * 5 + Number(sharedAny) * 1 + Number(sameCountry) * 1 + Number(closeEra) * 0.5 + Number(closeLength) * 0.5, sameAuthor };
}
