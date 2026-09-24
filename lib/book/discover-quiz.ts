import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { moods, quizCommitments, quizKinds, quizMoodOptions, startingBooks } from "@/lib/book/discover-config";
import { commitmentOf, isPublicDiscoveryBook, scoreCollection, type CatalogDiscoverySignals } from "@/lib/book/discovery-signals";

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
  const lengthMatch = commitment && commitmentOf(book.pageCount) === commitment.slug;
  const metadataScore = (kindScore?.metadataScore ?? 0) + (moodScore?.metadataScore ?? 0) + (lengthMatch ? 2 : 0);
  const editorialScore = (kindScore?.editorialScore ?? 0) + (moodScore?.editorialScore ?? 0) +
    (book.slug && startingBooks.includes(book.slug) ? 0.25 : 0);
  const reasons = [
    kindScore?.score ? kind?.title : null,
    moodScore?.score ? quizMoodOptions.find((item) => item.slug === answers.mood)?.title : null,
    lengthMatch ? `خواندن ${commitment?.title}` : null,
  ].filter(Boolean);
  return { score: metadataScore + editorialScore, metadataScore, editorialScore, reason: reasons.length ? reasons.join("، ") : null };
}

export function selectQuizBooks(candidates: QuizCandidate[], answers: QuizAnswers, excludedIds: string[] = []) {
  const excluded = new Set(excludedIds.slice(0, 30));
  const unique = new Map<string, QuizCandidate>();
  for (const book of candidates) {
    if (!isPublicDiscoveryBook(book) || excluded.has(book.id)) continue;
    if (!unique.has(book.id)) unique.set(book.id, book);
  }
  // Zero-score books are a deterministic fallback when exact intent is scarce.
  const ranked = [...unique.values()].map((book) => ({ book, ...scoreQuizBook(book, answers) }))
    .sort((a, b) => b.score - a.score || a.book.id.localeCompare(b.book.id));
  const selected: typeof ranked = [];
  const authors = new Set<string>();
  for (let index = 0; index < ranked.length && selected.length < 3;) {
    const score = ranked[index].score;
    const group = [];
    while (index < ranked.length && ranked[index].score === score) group.push(ranked[index++]);
    while (group.length && selected.length < 3) {
      const next = group.findIndex((item) => !authors.has(item.book.author.trim().toLocaleLowerCase("fa")));
      const [item] = group.splice(next < 0 ? 0 : next, 1);
      selected.push(item);
      authors.add(item.book.author.trim().toLocaleLowerCase("fa"));
    }
  }
  return selected.map(({ book, reason }) => ({ id: book.id, reason }));
}
