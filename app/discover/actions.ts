"use server";

import { getDiscoveryBooks } from "@/lib/book/discover-service";
import { isQuizAnswers, selectQuizBooks, type QuizRecommendation } from "@/lib/book/discover-quiz";

export async function recommendQuizBooks(answers: unknown, excludedIds: string[] = []): Promise<QuizRecommendation[]> {
  if (!isQuizAnswers(answers)) throw new Error("Invalid discovery choices");
  const books = await getDiscoveryBooks();
  const safeExcludedIds = Array.isArray(excludedIds) ? excludedIds.filter((id): id is string => typeof id === "string").slice(0, 30) : [];
  const results = selectQuizBooks([...books.values()], answers, safeExcludedIds);
  // Fewer than three real catalog books cannot satisfy the product promise.
  return results.length === 3 ? results : [];
}
