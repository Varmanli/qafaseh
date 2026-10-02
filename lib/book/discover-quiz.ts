import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { moods, quizCommitments, quizKinds, quizMoodOptions, startingBooks } from "@/lib/book/discover-config";
import { commitmentOf, discoveryQuality, scoreCollection, uniqueDiscoveryBooks, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
import { discoveryDay, rankRecommendations, RECOMMENDATION_WEIGHTS } from "@/lib/book/recommendation-ranking";
import { normalizeSearchText } from "@/lib/book/search-normalize";

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

export function scoreQuizBook(book: QuizCandidate, answers: QuizAnswers) {
  const kind = quizKinds.find((item) => item.slug === answers.kind);
  const mood = moods.find((item) => item.slug === answers.mood);
  const commitment = quizCommitments.find((item) => item.slug === answers.commitment);
  const kindScore = kind ? scoreCollection(book, kind) : null;
  const moodScore = mood ? scoreCollection(book, mood) : null;
  const knownLength = commitmentOf(book.pageCount);
  const multiVolume = /(?:^|\s)(?:[2-9]|[1-9][0-9]+|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده)\s*جلدی(?:\s|$)/.test(normalizeSearchText(book.title));
  const lengthMatch = commitment && knownLength === commitment.slug;
  const lengthConflict = commitment && ((knownLength !== null && !lengthMatch) ||
    (knownLength === null && multiVolume && commitment.slug !== "long"));
  const metadataScore = (kindScore?.metadataScore ?? 0) + (moodScore?.metadataScore ?? 0) +
    (lengthMatch ? RECOMMENDATION_WEIGHTS.quizCommitment : lengthConflict ? RECOMMENDATION_WEIGHTS.quizKnownLengthConflict : 0);
  const semanticScore = (kindScore?.semanticScore ?? 0) + (moodScore?.semanticScore ?? 0);
  const noIntent = Object.values(answers).every((answer) => answer === "any");
  const editorialScore = (kindScore?.editorialScore ?? 0) + (moodScore?.editorialScore ?? 0) +
    (noIntent && book.slug && startingBooks.includes(book.slug) ? RECOMMENDATION_WEIGHTS.quizStartingBook : 0);
  const kindMatch = Boolean(kindScore?.score);
  const moodMatch = Boolean(moodScore?.score);
  const reasons = [
    kindMatch ? `انتخاب ${kind?.title}` : null,
    moodMatch ? collectionQuizReason(book, mood!) : null,
    multiVolume && (knownLength !== null || !commitment) ? "مجموعهٔ چندجلدی" : null,
    lengthMatch ? `${book.pageCount?.toLocaleString("fa-IR")} صفحه؛ خواندن ${commitment?.title}` : commitment && knownLength === null ? multiVolume ? "مجموعهٔ چندجلدی؛ حجم کل مشخص نیست" : "حجم کتاب مشخص نیست" : null,
  ].filter(Boolean);
  return { score: metadataScore + semanticScore + editorialScore + discoveryQuality(book), metadataScore, semanticScore, editorialScore,
    kindMatch, moodMatch, lengthConflict: Boolean(lengthConflict), unknownLength: Boolean(commitment && knownLength === null),
    moodConflict: Boolean(moodScore?.conflict),
    factors: [
      { signal: "kind_metadata", score: kindScore?.metadataScore ?? 0 },
      { signal: "mood_metadata", score: moodScore?.metadataScore ?? 0 },
      { signal: "commitment", score: lengthMatch ? RECOMMENDATION_WEIGHTS.quizCommitment : lengthConflict ? RECOMMENDATION_WEIGHTS.quizKnownLengthConflict : 0 },
      { signal: "editorial", score: editorialScore },
      { signal: "description", score: semanticScore },
      { signal: "presentation", score: discoveryQuality(book) },
    ].filter((factor) => factor.score !== 0),
    reason: reasons.length ? `${kind && !kindMatch ? "نزدیک به حال‌وهوایت، با گونه‌ای متفاوت؛ " : ""}${reasons.join("، ")}` : null };
}

function collectionQuizReason(book: QuizCandidate, mood: (typeof moods)[number]) {
  const match = scoreCollection(book, mood);
  const title = quizMoodOptions.find((item) => item.slug === mood.slug)?.title;
  const evidence = match.matchedGenres[0] ?? match.matchedTerms[0];
  return evidence ? `${title}: ${evidence}` : `حال‌وهوای ${title} از انتخاب‌های قفسه`;
}

export function selectQuizBooks(candidates: QuizCandidate[], answers: QuizAnswers, excludedIds: string[] = [], day = discoveryDay(), limit = 3) {
  const noIntent = Object.values(answers).every((answer) => answer === "any");
  const ranked = uniqueDiscoveryBooks(candidates, excludedIds).map((book) => ({ book, ...scoreQuizBook(book, answers) }))
    .filter((item) => !item.lengthConflict && !item.moodConflict &&
      (answers.mood !== "any" ? item.moodMatch : answers.kind !== "any" ? item.kindMatch : noIntent || item.unknownLength || item.metadataScore > 0));
  const seed = `${day}:quiz:${answers.kind}:${answers.mood}:${answers.commitment}`;
  // All content choices first, then unknown length, then a disclosed partial kind match.
  // A long book cannot bypass the requested short length by stacking genre hits.
  const selected: (typeof ranked)[number][] = [];
  for (const tier of [0, 1, 2, 3]) {
    const group = ranked.filter((item) => Number(answers.kind !== "any" && !item.kindMatch) * 2 + Number(item.unknownLength) === tier);
    selected.push(...rankRecommendations(group, limit - selected.length, seed, selected.map(({ book }) => book)));
    if (selected.length >= limit) break;
  }
  return selected.map(({ book, reason }) => ({ id: book.id, reason }));
}
