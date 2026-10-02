"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getQuizRecommendations } from "@/lib/book/discovery-recommendations";
import { isQuizAnswers, type QuizRecommendation } from "@/lib/book/discover-quiz";

export async function recommendQuizBooks(answers: unknown, excludedIds: string[] = []): Promise<QuizRecommendation[]> {
  if (!isQuizAnswers(answers)) throw new Error("Invalid discovery choices");
  const safeExcludedIds = Array.isArray(excludedIds) ? excludedIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128).slice(0, 30) : [];
  const viewer = await getCurrentUser();
  return getQuizRecommendations({ kind: answers.kind, mood: answers.mood, commitment: answers.commitment }, safeExcludedIds, viewer?.id);
}
