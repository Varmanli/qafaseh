import { and, inArray } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook } from "@/db/schema";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { publicCatalogBookCondition } from "@/lib/book/discover-service";
import { similarBooksById } from "@/lib/book/similar-books-config";

const MAX_SIMILAR_BOOKS = 6;

export type SimilarBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
};

type Candidate = Omit<SimilarBook, "slug"> & { slug: string | null; status?: string };

export function selectSimilarBooks(sourceId: string, relatedIds: readonly string[], candidates: Candidate[]): SimilarBook[] {
  const byId = new Map(candidates.map((book) => [book.id, book]));
  const seen = new Set([sourceId]);
  const selected: SimilarBook[] = [];
  for (const id of relatedIds) {
    if (selected.length === MAX_SIMILAR_BOOKS) break;
    const book = byId.get(id);
    if (seen.has(id) || !book?.slug?.trim() || !book.title.trim() || book.title.startsWith("[TEST:") ||
        (book.status && book.status !== "APPROVED")) continue;
    seen.add(id); // CatalogBook ID is the canonical work, not an edition ID.
    selected.push({ id: book.id, slug: book.slug, title: book.title, author: book.author, coverImage: book.coverImage });
  }
  return selected;
}

export async function getSimilarBooks(sourceBookId: string): Promise<SimilarBook[]> {
  const relatedIds = similarBooksById[sourceBookId];
  if (!relatedIds?.length) return [];

  const ids = [...new Set(relatedIds.filter((id) => id !== sourceBookId))].slice(0, MAX_SIMILAR_BOOKS);
  if (!ids.length) return [];
  const rows = await db.select({
    id: CatalogBook.id,
    slug: CatalogBook.slug,
    title: CatalogBook.title,
    author: CatalogBook.author,
    coverImage: displayCoverFieldSql(),
  }).from(CatalogBook)
    .where(and(publicCatalogBookCondition, inArray(CatalogBook.id, ids)))
    .limit(ids.length);

  return selectSimilarBooks(sourceBookId, ids, rows);
}
