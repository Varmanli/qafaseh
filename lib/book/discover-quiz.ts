import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { moods, quizCommitments, quizKinds, quizMoodOptions, startingBooks } from "@/lib/book/discover-config";

export type QuizAnswers = { kind: string; mood: string; commitment: string };
export type QuizCandidate = ArchiveBookCardData & { status?: string; visibility?: string };
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

function match(slug: string, selected: string, collections: { slug: string; bookSlugs: string[] }[]) {
  return selected !== "any" && collections.find((item) => item.slug === selected)?.bookSlugs.includes(slug);
}

export function scoreQuizBook(book: QuizCandidate, answers: QuizAnswers) {
  const slug = book.slug ?? "";
  const reasons: string[] = [];
  let score = startingBooks.includes(slug) ? 1 : 0;
  if (match(slug, answers.mood, moods)) {
    score += 3;
    reasons.push(quizMoodOptions.find((item) => item.slug === answers.mood)!.title);
  }
  if (match(slug, answers.kind, quizKinds)) {
    score += 2;
    reasons.push(quizKinds.find((item) => item.slug === answers.kind)!.title);
  }
  if (match(slug, answers.commitment, quizCommitments)) {
    score += 2;
    reasons.push(`خواندن ${quizCommitments.find((item) => item.slug === answers.commitment)!.title}`);
  }
  return { score, reason: reasons.length ? reasons.join("، ") : null };
}

export function selectQuizBooks(candidates: QuizCandidate[], answers: QuizAnswers, excludedIds: string[] = []): QuizRecommendation[] {
  const excluded = new Set(excludedIds.slice(0, 30));
  const unique = new Map<string, QuizCandidate>();
  for (const book of candidates) {
    // The query already enforces public catalog status. Keep this guard so a
    // future caller cannot accidentally recommend private or test records.
    if (!book.id || !book.slug?.trim() || !book.title.trim() || book.title.startsWith("[TEST:") ||
        (book.status && book.status !== "APPROVED") ||
        (book.visibility && book.visibility !== "PUBLIC") || excluded.has(book.id)) continue;
    if (!unique.has(book.id)) unique.set(book.id, book);
  }

  // Every valid book remains a candidate. Missing traits simply score lower,
  // which relaxes commitment, then kind/mood, without producing zero results.
  const ranked = [...unique.values()].map((book) => ({ book, ...scoreQuizBook(book, answers) }))
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title, "fa") || a.book.id.localeCompare(b.book.id));

  const selected: typeof ranked = [];
  const authors = new Set<string>();
  for (let index = 0; index < ranked.length && selected.length < 3;) {
    const score = ranked[index].score;
    const group = [];
    while (index < ranked.length && ranked[index].score === score) group.push(ranked[index++]);
    while (group.length && selected.length < 3) {
      const next = group.findIndex((item) => !authors.has(item.book.author.trim().toLowerCase()));
      const [item] = group.splice(next < 0 ? 0 : next, 1);
      selected.push(item);
      authors.add(item.book.author.trim().toLowerCase());
    }
  }
  return selected.map(({ book, reason }) => ({
    id: book.id,
    slug: book.slug!,
    title: book.title,
    author: book.author,
    coverImage: book.coverImage,
    reason,
  }));
}
