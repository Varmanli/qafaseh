import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook } from "@/db/schema";
import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { moods, startingBooks, topics } from "@/lib/book/discover-config";

export const publicCatalogBookCondition = and(
  eq(CatalogBook.status, "APPROVED"),
  sql`${CatalogBook.slug} is not null and trim(${CatalogBook.slug}) <> ''`,
  sql`${CatalogBook.title} not like '[TEST:%'`,
);

const bookFields = {
  id: CatalogBook.id,
  slug: CatalogBook.slug,
  title: CatalogBook.title,
  author: CatalogBook.author,
  coverImage: displayCoverFieldSql(),
};

export async function getDiscoveryBooks(): Promise<Map<string, ArchiveBookCardData>> {
  const slugs = [...new Set([
    ...moods.flatMap((item) => item.bookSlugs),
    ...topics.flatMap((item) => item.bookSlugs),
    ...startingBooks,
  ])];
  const rows = await db.select(bookFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, inArray(CatalogBook.slug, slugs)))
    .limit(slugs.length);
  return new Map(rows.filter((book) => book.slug).map((book) => [book.slug!, book]));
}

export async function getRandomDiscoveryBook(): Promise<ArchiveBookCardData | null> {
  // A UUID cursor uses the primary-key index and returns at most one row per query.
  const cursor = randomUUID();
  const first = await db.select(bookFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, sql`${CatalogBook.id} >= ${cursor}`))
    .orderBy(CatalogBook.id).limit(1);
  if (first[0]) return first[0];
  const wrapped = await db.select(bookFields).from(CatalogBook)
    .where(publicCatalogBookCondition).orderBy(CatalogBook.id).limit(1);
  return wrapped[0] ?? null;
}
