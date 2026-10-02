import { randomInt } from "node:crypto";
import { and, eq, gt, inArray, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook } from "@/db/schema";
import type { ArchiveBookCardData } from "@/components/books/ArchiveBookCard";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import type { CatalogDiscoverySignals } from "@/lib/book/discovery-signals";
import type { DiscoveryCollection } from "@/lib/book/discover-config";
import { normalizeSearchText } from "@/lib/book/search-normalize";

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

const discoveryContentFields = {
  description: CatalogBook.description,
  hasCover: sql<boolean>`nullif(trim(${CatalogBook.coverImage}), '') is not null or exists (
    select 1 from "BookEdition" be where be.catalog_book_id = ${CatalogBook.id}
      and be.status = 'APPROVED' and nullif(trim(be.cover_image), '') is not null
  )`,
};

export async function getCatalogDiscoverySignals(): Promise<CatalogDiscoverySignals[]> {
  const rows: CatalogDiscoverySignals[] = [];
  let after: string | undefined;
  // Keyset pages keep query memory bounded without imposing an eligibility cap.
  for (;;) {
    const page = await db.select({ ...discoverySignalFields, ...discoveryContentFields }).from(CatalogBook)
      .where(and(publicCatalogBookCondition, after ? gt(CatalogBook.id, after) : undefined))
      .orderBy(CatalogBook.id).limit(1000);
    rows.push(...page);
    if (page.length < 1000) return rows;
    after = page[page.length - 1].id;
  }
}

export function getDiscoveryCandidates(collections: DiscoveryCollection[], excludedIds: string[] = [], database: Pick<typeof db, "select"> = db) {
  const terms = [...new Set(collections.flatMap((collection) => [...collection.genres, ...(collection.descriptionTerms ?? [])]).map(normalizeSearchText))];
  const slugs = [...new Set(collections.flatMap((collection) => collection.editorialBookSlugs ?? []))];
  const document = CatalogBook.discoveryText;
  const match = collections.length ? or(
    ...terms.map((term) => sql`${document} like ${`%${term}%`}`),
    slugs.length ? inArray(CatalogBook.slug, slugs) : undefined,
  ) : undefined;
  // Indexed prefilter only removes impossible matches; there is no pre-ranking LIMIT.
  // For an exploratory quiz, full descriptions are unnecessary.
  return database.select({ ...discoverySignalFields, ...discoveryContentFields,
    description: collections.length ? CatalogBook.description : sql<string | null>`left(${CatalogBook.description}, 256)`,
  }).from(CatalogBook).where(and(publicCatalogBookCondition, match,
    excludedIds.length ? notInArray(CatalogBook.id, excludedIds) : undefined));
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
