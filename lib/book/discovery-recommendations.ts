import { unstable_cache } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { Book } from "@/db/schema";
import { moods, quizKinds, topics, type DiscoveryCollection } from "./discover-config";
import { getDiscoveryCandidates, getDiscoveryCards } from "./discover-service";
import { selectQuizBooks, type QuizAnswers } from "./discover-quiz";
import { selectCollectionBooks } from "./discovery-signals";
import { discoveryDay } from "./recommendation-ranking";

const POOL_SIZE = 96;
const COLLECTION_PAGE_SIZE = 20;
export const COLLECTION_MAX_PAGES = 5;
type PickedBook = { id: string; reason: string | null };

function quizCollections(answers: QuizAnswers) {
  const mood = moods.find((item) => item.slug === answers.mood);
  const kind = quizKinds.find((item) => item.slug === answers.kind);
  return mood ? [mood] : kind ? [kind] : [];
}

// Cache small public rankings, never cookies, reading history or the full catalog.
// Cache Components is not enabled in this app, so use the existing Data Cache API.
const quizPool = unstable_cache(async (answers: QuizAnswers, day: string) =>
  selectQuizBooks(await getDiscoveryCandidates(quizCollections(answers)), answers, [], day, POOL_SIZE),
  ["discovery-quiz-v4"], { revalidate: 300 });

const collectionPool = unstable_cache(async (slug: string, day: string) => {
  const collection = [...moods, ...topics].find((item) => item.slug === slug);
  return collection ? selectCollectionBooks(await getDiscoveryCandidates([collection]), collection, POOL_SIZE, day) : [];
}, ["discovery-collection-v4"], { revalidate: 300 });

export async function getDiscoveryExclusions(viewerId?: string) {
  if (!viewerId) return [];
  const rows = await db.select({ id: Book.catalogBookId }).from(Book).where(and(
    eq(Book.userId, viewerId), inArray(Book.status, ["FINISHED", "READING", "PAUSED", "STOPPED"]),
  ));
  return [...new Set(rows.flatMap(({ id }) => id ? [id] : []))];
}

async function resolvePool(pool: PickedBook[], excludedIds: string[]) {
  const excluded = new Set(excludedIds);
  const picks = pool.filter(({ id }) => !excluded.has(id));
  // Recheck approval and public route eligibility on every request, even on cache hits.
  const cards = await getDiscoveryCards(picks.map(({ id }) => id));
  const byId = new Map(cards.map((book) => [book.id, book]));
  return picks.flatMap(({ id, reason }) => {
    const book = byId.get(id);
    return book?.slug ? [{ ...book, slug: book.slug, reason }] : [];
  });
}

export async function getQuizRecommendations(answers: QuizAnswers, seenIds: string[] = [], viewerId?: string) {
  const day = discoveryDay();
  const [pool, history] = await Promise.all([quizPool(answers, day), getDiscoveryExclusions(viewerId)]);
  const excluded = [...history, ...seenIds];
  const books = await resolvePool(pool, excluded);
  // A large reading history must not turn a bounded cache into a catalog cutoff.
  if (pool.length === POOL_SIZE && books.length < 3) {
    const fresh = selectQuizBooks(await getDiscoveryCandidates(quizCollections(answers), [...excluded, ...pool.map(({ id }) => id)]), answers, [], day, POOL_SIZE);
    books.push(...await resolvePool(fresh, excluded));
  }
  return books.slice(0, 3);
}

export async function getCollectionRecommendations(collection: DiscoveryCollection, viewerId?: string, page = 1) {
  page = Math.min(COLLECTION_MAX_PAGES, Math.max(1, Number.isInteger(page) ? page : 1));
  const day = discoveryDay();
  const [pool, excluded] = await Promise.all([collectionPool(collection.slug, day), getDiscoveryExclusions(viewerId)]);
  const books = await resolvePool(pool, excluded);
  const offset = (page - 1) * COLLECTION_PAGE_SIZE;
  if (pool.length === POOL_SIZE && books.length <= offset + COLLECTION_PAGE_SIZE) {
    const fresh = selectCollectionBooks(await getDiscoveryCandidates([collection], [...excluded, ...pool.map(({ id }) => id)]), collection,
      offset + COLLECTION_PAGE_SIZE + 1 - books.length, day);
    books.push(...await resolvePool(fresh, excluded));
  }
  return { books: books.slice(offset, offset + COLLECTION_PAGE_SIZE), hasMore: page < COLLECTION_MAX_PAGES && books.length > offset + COLLECTION_PAGE_SIZE };
}
