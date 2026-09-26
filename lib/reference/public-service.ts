import { and, arrayContains, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { ReferenceItem } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import type { BookPresentationEdition } from "@/lib/book/presentation";
import type { ReferenceTypeValue } from "@/lib/validations/reference";
import { slugify } from "@/lib/book/slug";

// Keep the public profile projection explicit while including the stored
// profile copy used by the shared public reference view.
export const PUBLIC_REFERENCE_COLUMNS = {
  id: ReferenceItem.id,
  type: ReferenceItem.type,
  roles: ReferenceItem.roles,
  canonicalReferenceId: ReferenceItem.canonicalReferenceId,
  name: ReferenceItem.name,
  slug: ReferenceItem.slug,
  coverImage: ReferenceItem.coverImage,
  bannerImage: ReferenceItem.bannerImage,
  originalName: ReferenceItem.originalName,
  imageFilename: ReferenceItem.imageFilename,
  sourceName: ReferenceItem.sourceName,
  sourceUrl: ReferenceItem.sourceUrl,
  seoTitle: ReferenceItem.seoTitle,
  seoDescription: ReferenceItem.seoDescription,
  birthYear: ReferenceItem.birthYear,
  deathYear: ReferenceItem.deathYear,
  countryName: ReferenceItem.countryName,
  countrySlug: ReferenceItem.countrySlug,
  website: ReferenceItem.website,
  description: ReferenceItem.description,
  shortDescription: ReferenceItem.shortDescription,
} as const;

export interface ReferenceEntity {
  id: string;
  type: ReferenceTypeValue;
  roles: ReferenceTypeValue[];
  name: string;
  slug: string;
  coverImage: string | null;
  bannerImage: string | null;
  originalName: string | null;
  description: string | null;
  shortDescription: string | null;
  imageFilename: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  birthYear: number | null;
  deathYear: number | null;
  countryName: string | null;
  countrySlug: string | null;
  website: string | null;
}

export interface ReferenceBookCard {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  translator: string | null;
  publisher: string | null;
  coverImage: string | null;
  rating: number | null;
  createdAt: Date;
  displayEdition?: BookPresentationEdition | null;
}

/** مسیر عمومی هر نوع موجودیت. */
export const ROUTE_BY_TYPE: Record<ReferenceTypeValue, string> = {
  AUTHOR: "authors",
  TRANSLATOR: "translators",
  PUBLISHER: "publishers",
  COUNTRY: "countries",
  GENRE: "genres",
};

/**
 * موجودیت مرجع عمومی را با اسلاگ یا نام (هردو) پیدا می‌کند. فقط موارد APPROVED
 * عمومی‌اند؛ PENDING/REJECTED برای عموم نامرئی است.
 */
export async function getReferenceEntity(
  type: ReferenceTypeValue,
  ref: string
): Promise<ReferenceEntity | null> {
  const normalizedRef = slugify(ref);
  const roleCondition = type === "AUTHOR" || type === "TRANSLATOR"
    ? arrayContains(ReferenceItem.roles, [type])
    : eq(ReferenceItem.type, type);
  const exactRows = await db.select(PUBLIC_REFERENCE_COLUMNS).from(ReferenceItem)
    .where(and(roleCondition, eq(ReferenceItem.status, "APPROVED"), eq(ReferenceItem.slug, ref)))
    .orderBy(sql`CASE WHEN ${ReferenceItem.canonicalReferenceId} IS NULL THEN 0 ELSE 1 END`)
    .limit(1);

  let row = exactRows[0];
  if (!row && normalizedRef) {
    const normalizedRows = await db
      .select(PUBLIC_REFERENCE_COLUMNS)
      .from(ReferenceItem)
      .where(and(roleCondition, eq(ReferenceItem.status, "APPROVED"), eq(ReferenceItem.slugNormalized, normalizedRef)))
      .orderBy(sql`CASE WHEN ${ReferenceItem.canonicalReferenceId} IS NULL THEN 0 ELSE 1 END`)
      .limit(2);
    // A normalized key can collide in old data; a non-exact URL must never
    // choose one of two distinct people merely because their names look alike.
    const canonicalMatches = normalizedRows.filter((item) => !item.canonicalReferenceId);
    if (canonicalMatches.length === 1) row = canonicalMatches[0];
    else if (!canonicalMatches.length && normalizedRows.length === 1) row = normalizedRows[0];
  }

  if (!row) {
    const nameRows = await db
      .select(PUBLIC_REFERENCE_COLUMNS)
      .from(ReferenceItem)
      .where(and(roleCondition, eq(ReferenceItem.status, "APPROVED"), sql`lower(${ReferenceItem.name}) = lower(${ref})`))
      .orderBy(sql`CASE WHEN ${ReferenceItem.canonicalReferenceId} IS NULL THEN 0 ELSE 1 END`)
      .limit(2);
    const canonicalMatches = nameRows.filter((item) => !item.canonicalReferenceId);
    if (canonicalMatches.length === 1) row = canonicalMatches[0];
    else if (!canonicalMatches.length && nameRows.length === 1) row = nameRows[0];
  }

  if (row?.canonicalReferenceId) {
    const [canonical] = await db.select(PUBLIC_REFERENCE_COLUMNS).from(ReferenceItem)
      .where(and(eq(ReferenceItem.id, row.canonicalReferenceId), eq(ReferenceItem.status, "APPROVED"), isNull(ReferenceItem.canonicalReferenceId)))
      .limit(1);
    row = canonical;
  }
  if (!row?.slug) return null;
  return {
    ...row,
    slug: row.slug,
    coverImage: coalesceCoverImage(row.coverImage),
  };
}
