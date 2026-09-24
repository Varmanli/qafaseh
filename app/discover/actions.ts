"use server";

import { getCatalogDiscoverySignals, getDiscoveryCards } from "@/lib/book/discover-service";
import { isQuizAnswers, selectQuizBooks, type QuizRecommendation } from "@/lib/book/discover-quiz";

export async function recommendQuizBooks(answers: unknown, excludedIds: string[] = []): Promise<QuizRecommendation[]> {
  if (!isQuizAnswers(answers)) throw new Error("Invalid discovery choices");
  const books = await getCatalogDiscoverySignals();
  const safeExcludedIds = Array.isArray(excludedIds) ? excludedIds.filter((id): id is string => typeof id === "string").slice(0, 30) : [];
  const selected = selectQuizBooks(books, answers, safeExcludedIds);
  const cards = await getDiscoveryCards(selected.map((item) => item.id));
  const byId = new Map(cards.map((book) => [book.id, book]));
  const results = selected.flatMap(({ id, reason }) => {
    const book = byId.get(id);
    return book?.slug ? [{ ...book, slug: book.slug, reason }] : [];
  });
  // Fewer than three real catalog books cannot satisfy the product promise.
  return results.length === 3 ? results : [];
}
