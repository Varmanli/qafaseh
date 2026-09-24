import { randomInt } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook } from "@/db/schema";
import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import type { CatalogDiscoverySignals } from "@/lib/book/discovery-signals";

export const publicCatalogBookCondition = and(
  eq(CatalogBook.status, "APPROVED"),
  sql`${CatalogBook.slug} is not null and trim(${CatalogBook.slug}) <> ''`,
  sql`trim(${CatalogBook.title}) <> ''`,
  sql`${CatalogBook.title} not like '[TEST:%'`,
);

const bookFields = {
  id: CatalogBook.id,
  slug: CatalogBook.slug,
  title: CatalogBook.title,
  author: CatalogBook.author,
  coverImage: displayCoverFieldSql(),
};
export const discoverySignalFields = {
  id: CatalogBook.id, slug: CatalogBook.slug, title: CatalogBook.title,
  author: CatalogBook.author, genre: CatalogBook.genre,
  contributorIds: sql<string[]>`coalesce((
    select array_agg(c.reference_item_id order by c.reference_item_id)
    from "CatalogBookContributor" c
    where c.catalog_book_id = "CatalogBook"."id" and c.role = 'AUTHOR'
  ), array[]::varchar[])`,
  country: CatalogBook.country, language: CatalogBook.language,
  firstPublishedYear: CatalogBook.firstPublishedYear,
  pageCount: preferredEditionFieldSql<number | null>("page_count", {
    catalogBookId: sql.raw('"CatalogBook"."id"'),
    primaryEditionId: sql.raw('"CatalogBook"."primary_edition_id"'),
  }),
};

export async function getCatalogDiscoverySignals(): Promise<CatalogDiscoverySignals[]> {
  const rows: CatalogDiscoverySignals[] = [];
  let after: string | undefined;
  // Keyset pages keep query memory bounded without imposing an eligibility cap.
  for (;;) {
    const page = await db.select(discoverySignalFields).from(CatalogBook)
      .where(and(publicCatalogBookCondition, after ? gt(CatalogBook.id, after) : undefined))
      .orderBy(CatalogBook.id).limit(1000);
    rows.push(...page);
    if (page.length < 1000) return rows;
    after = page[page.length - 1].id;
  }
}

export async function getDiscoveryCards(ids: string[]): Promise<ArchiveBookCardData[]> {
  if (!ids.length) return [];
  const rows = await db.select(bookFields).from(CatalogBook)
    .where(and(publicCatalogBookCondition, inArray(CatalogBook.id, ids))).limit(ids.length);
  const byId = new Map(rows.map((book) => [book.id, book]));
  return ids.flatMap((id) => {
    const book = byId.get(id);
    return book ? [book] : [];
  });
}

export async function getRandomDiscoveryBook(): Promise<ArchiveBookCardData | null> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(CatalogBook)
    .where(publicCatalogBookCondition);
  if (!count) return null;
  const [book] = await db.select(bookFields).from(CatalogBook)
    .where(publicCatalogBookCondition).orderBy(CatalogBook.id).limit(1).offset(randomInt(count));
  return book ?? null;
}
