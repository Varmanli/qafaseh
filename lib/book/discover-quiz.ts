import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { moods, quizCommitments, quizKinds, quizMoodOptions, startingBooks } from "@/lib/book/discover-config";
import { commitmentOf, isPublicDiscoveryBook, scoreCollection, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
import { discoveryDay, rankRecommendations, RECOMMENDATION_WEIGHTS } from "@/lib/book/recommendation-ranking";

export type QuizAnswers = { kind: string; mood: string; commitment: string };
export type QuizCandidate = CatalogDiscoverySignals;
export type QuizRecommendation = Omit<ArchiveBookCardData, "slug"> & { slug: string; reason: string | null };

export function isQuizAnswers(value: unknown): value is QuizAnswers {
  if (!value || typeof value !== "object") return false;
  const answers = value as Record<string, unknown>;
  return (
    (answers.kind === "any" || quizKinds.some((item) => item.slug === answers.kind)) &&
    (answers.mood === "any" || quizMoodOptions.some((item) => item.slug === answers.mood)) &&
    (answers.commitment === "any" || quizCommitments.some((item) => item.slug === answers.commitment))
  );
}

// Score components stay separate so a future semantic signal can be added
// without changing eligibility or the database metadata interpretation.
export function scoreQuizBook(book: QuizCandidate, answers: QuizAnswers) {
  const kind = quizKinds.find((item) => item.slug === answers.kind);
  const mood = moods.find((item) => item.slug === answers.mood);
  const commitment = quizCommitments.find((item) => item.slug === answers.commitment);
  const kindScore = kind ? scoreCollection(book, kind) : null;
  const moodScore = mood ? scoreCollection(book, mood) : null;
  const knownLength = commitmentOf(book.pageCount);
  const lengthMatch = commitment && knownLength === commitment.slug;
  const lengthConflict = commitment && knownLength !== null && !lengthMatch;
  const metadataScore = (kindScore?.metadataScore ?? 0) + (moodScore?.metadataScore ?? 0) +
    (lengthMatch ? RECOMMENDATION_WEIGHTS.quizCommitment : lengthConflict ? RECOMMENDATION_WEIGHTS.quizKnownLengthConflict : 0);
  const editorialScore = (kindScore?.editorialScore ?? 0) + (moodScore?.editorialScore ?? 0) +
    (book.slug && startingBooks.includes(book.slug) ? RECOMMENDATION_WEIGHTS.quizStartingBook : 0);
  const reasons = [
    kindScore?.score ? kind?.title : null,
    moodScore?.score ? quizMoodOptions.find((item) => item.slug === answers.mood)?.title : null,
    lengthMatch ? `خواندن ${commitment?.title}` : null,
  ].filter(Boolean);
  return { score: metadataScore + editorialScore, metadataScore, editorialScore,
    factors: [
      { signal: "kind_metadata", score: kindScore?.metadataScore ?? 0 },
      { signal: "mood_metadata", score: moodScore?.metadataScore ?? 0 },
      { signal: "commitment", score: lengthMatch ? RECOMMENDATION_WEIGHTS.quizCommitment : lengthConflict ? RECOMMENDATION_WEIGHTS.quizKnownLengthConflict : 0 },
      { signal: "editorial", score: editorialScore },
    ].filter((factor) => factor.score !== 0),
    reason: reasons.length ? reasons.join("، ") : null };
}

export function selectQuizBooks(candidates: QuizCandidate[], answers: QuizAnswers, excludedIds: string[] = [], day = discoveryDay()) {
  const excluded = new Set(excludedIds.slice(0, 30));
  const unique = new Map<string, QuizCandidate>();
  for (const book of candidates) {
    if (!isPublicDiscoveryBook(book) || excluded.has(book.id)) continue;
    if (!unique.has(book.id)) unique.set(book.id, book);
  }
  const noIntent = Object.values(answers).every((answer) => answer === "any");
  const ranked = [...unique.values()].map((book) => ({ book, ...scoreQuizBook(book, answers) }))
    .filter(({ score }) => noIntent || score > 0);
  const selected = rankRecommendations(ranked, 3, `${day}:quiz:${answers.kind}:${answers.mood}:${answers.commitment}`);
  return selected.map(({ book, reason }) => ({ id: book.id, reason }));
}
