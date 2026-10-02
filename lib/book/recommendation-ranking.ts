import { splitStoredGenres } from "./genres";
import type { CatalogDiscoverySignals } from "./discovery-signals";
import { normalizeSearchText } from "./search-normalize";

const BROAD_GENRES = new Set(["داستان", "ادبیات", "ادبیات داستانی", "ادبیات معاصر", "رمان"]);
const SPECIFIC_LITERATURE_GENRES = new Set(["ادبیات کلاسیک", "ادبیات رئالیسم جادویی"]);
export function isBroadGenre(genre: string) { return BROAD_GENRES.has(normalizeSearchText(genre)); }
export function distinctiveGenres(book: Pick<CatalogDiscoverySignals, "genre">): string[] {
  return splitStoredGenres(book.genre).map(normalizeSearchText)
    .filter((genre) => !isBroadGenre(genre) && !genre.startsWith("دهه ") &&
      (!genre.startsWith("ادبیات ") || SPECIFIC_LITERATURE_GENRES.has(genre)));
}

// Scores below the best remaining candidate by more than this never compete
// for the same slot. Rotation and diversity only reorder near-equals.
export const RECOMMENDATION_WEIGHTS = {
  specificGenre: 4,
  broadGenre: 1.5,
  editorial: 1.5,
  quizCommitment: 1.5,
  quizKnownLengthConflict: -0.5,
  quizStartingBook: 0.15,
  similarSharedSpecificGenre: 4,
  similarSameAuthor: 3,
  similarSharedBroadGenre: 0.75,
  similarSameCountry: 0.5,
  similarCloseEra: 0.25,
  similarCloseLength: 0.25,
  similarCuratedFillThreshold: 4.5,
  rotationMax: 0.3,
  sameAuthorPenalty: 0.6,
  sharedSpecificGenrePenalty: 0.2,
  relevanceWindow: 0.75,
} as const;

export function discoveryDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function seededFraction(seed: string, id: string) {
  let hash = 2166136261;
  for (const char of `${seed}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export type RankedCandidate<T extends CatalogDiscoverySignals> = { book: T; score: number };

export function rankRecommendations<T extends CatalogDiscoverySignals, C extends RankedCandidate<T>>(
  candidates: C[], limit: number, seed: string, preselected: T[] = [],
): C[] {
  const remaining = [...candidates].sort((a, b) => b.score - a.score || a.book.id.localeCompare(b.book.id));
  const selected: C[] = [];
  const authors = new Set<string>();
  const contributorIds = new Set<string>();
  const selectedGenres = new Set<string>();
  const traits = new Map(candidates.map(({ book }) => [book.id, {
    author: normalizeSearchText(book.author), genres: distinctiveGenres(book),
    rotation: seededFraction(seed, book.id) * RECOMMENDATION_WEIGHTS.rotationMax,
  }]));
  function remember(book: T) {
    const author = normalizeSearchText(book.author);
    if (author) authors.add(author);
    for (const id of book.contributorIds) contributorIds.add(id);
    for (const genre of distinctiveGenres(book)) selectedGenres.add(genre);
  }
  preselected.forEach(remember);
  while (remaining.length && selected.length < limit) {
    const best = remaining[0].score;
    let winner = 0;
    let winnerScore = -Infinity;
    for (let index = 0; index < remaining.length && remaining[index].score >= best - RECOMMENDATION_WEIGHTS.relevanceWindow; index++) {
      const item = remaining[index];
      const { author, genres, rotation } = traits.get(item.book.id)!;
      const sameAuthor = authors.has(author) || item.book.contributorIds.some((id) => contributorIds.has(id));
      const sharedGenre = genres.some((genre) => selectedGenres.has(genre));
      const adjusted = item.score + rotation
        - (sameAuthor ? RECOMMENDATION_WEIGHTS.sameAuthorPenalty : 0)
        - (sharedGenre ? RECOMMENDATION_WEIGHTS.sharedSpecificGenrePenalty : 0);
      if (adjusted > winnerScore) { winner = index; winnerScore = adjusted; }
    }
    const [item] = remaining.splice(winner, 1);
    selected.push(item);
    remember(item.book);
  }
  return selected;
}
