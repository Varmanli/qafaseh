import { splitStoredGenres } from "./genres";
import type { CatalogDiscoverySignals } from "./discovery-signals";

const BROAD_GENRES = new Set(["داستان", "ادبیات", "ادبیات داستانی", "ادبیات معاصر", "رمان"]);
const SPECIFIC_LITERATURE_GENRES = new Set(["ادبیات کلاسیک", "ادبیات رئالیسم جادویی"]);
export function isBroadGenre(genre: string) { return BROAD_GENRES.has(genre.toLocaleLowerCase("fa")); }
export function distinctiveGenres(book: Pick<CatalogDiscoverySignals, "genre">): string[] {
  return splitStoredGenres(book.genre).map((genre) => genre.toLocaleLowerCase("fa"))
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
  const prior = [...preselected];
  while (remaining.length && selected.length < limit) {
    const best = remaining[0].score;
    let winner = 0;
    let winnerScore = -Infinity;
    for (let index = 0; index < remaining.length && remaining[index].score >= best - RECOMMENDATION_WEIGHTS.relevanceWindow; index++) {
      const item = remaining[index];
      const author = item.book.author.trim().toLocaleLowerCase("fa");
      const genres = distinctiveGenres(item.book);
      const sameAuthor = prior.some((book) =>
        (author && book.author.trim().toLocaleLowerCase("fa") === author) ||
        item.book.contributorIds.some((id) => book.contributorIds.includes(id)));
      const sharedGenre = genres.length && prior.some((book) => distinctiveGenres(book).some((genre) => genres.includes(genre)));
      const adjusted = item.score + seededFraction(seed, item.book.id) * RECOMMENDATION_WEIGHTS.rotationMax
        - (sameAuthor ? RECOMMENDATION_WEIGHTS.sameAuthorPenalty : 0)
        - (sharedGenre ? RECOMMENDATION_WEIGHTS.sharedSpecificGenrePenalty : 0);
      if (adjusted > winnerScore) { winner = index; winnerScore = adjusted; }
    }
    const [item] = remaining.splice(winner, 1);
    selected.push(item);
    prior.push(item.book);
  }
  return selected;
}
