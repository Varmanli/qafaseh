import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { Book, CatalogBook, ReferenceItem } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { STORED_GENRE_SEPARATOR } from "@/lib/book/genres";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import type { BookPresentationEdition } from "@/lib/book/presentation";
import type { ReferenceTypeValue } from "@/lib/validations/reference";
import { slugify } from "@/lib/book/slug";

// Public profile pages must not read optional biography TOAST values.  The
// importer/admin projection remains unchanged because those workflows need
// the stored text.
export const PUBLIC_REFERENCE_COLUMNS = {
  id: ReferenceItem.id,
  type: ReferenceItem.type,
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
  description: sql<string | null>`null`,
  shortDescription: sql<string | null>`null`,
} as const;

export interface ReferenceEntity {
  id: string;
  type: ReferenceTypeValue;
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

/** فیلد رشته‌ای متناظر در جدول Book برای هر نوع موجودیت. */
const FIELD_BY_TYPE = {
  AUTHOR: Book.author,
  TRANSLATOR: Book.translator,
  PUBLISHER: Book.publisher,
  COUNTRY: Book.country,
  GENRE: Book.genre,
} as const;

/**
 * موجودیت مرجع عمومی را با اسلاگ یا نام (هردو) پیدا می‌کند. فقط موارد APPROVED
 * عمومی‌اند؛ PENDING/REJECTED برای عموم نامرئی است.
 */
export async function getReferenceEntity(
  type: ReferenceTypeValue,
  ref: string
): Promise<ReferenceEntity | null> {
  const normalizedRef = slugify(ref);
  const exactRows = await db
    .select({
      ...PUBLIC_REFERENCE_COLUMNS,
    })
    .from(ReferenceItem)
    .where(
      and(
        eq(ReferenceItem.type, type),
        eq(ReferenceItem.status, "APPROVED"),
        eq(ReferenceItem.slug, ref),
      )
    )
    .limit(1);

  let row = exactRows[0];
  if (!row && normalizedRef) {
    const normalizedRows = await db
      .select(PUBLIC_REFERENCE_COLUMNS)
      .from(ReferenceItem)
      .where(and(eq(ReferenceItem.type, type), eq(ReferenceItem.status, "APPROVED"), eq(ReferenceItem.slugNormalized, normalizedRef)))
      .limit(2);
    // A normalized key can collide in old data; a non-exact URL must never
    // choose one of two distinct people merely because their names look alike.
    if (normalizedRows.length === 1) row = normalizedRows[0];
  }

  if (!row) {
    const nameRows = await db
      .select(PUBLIC_REFERENCE_COLUMNS)
      .from(ReferenceItem)
      .where(and(eq(ReferenceItem.type, type), eq(ReferenceItem.status, "APPROVED"), sql`lower(${ReferenceItem.name}) = lower(${ref})`))
      .limit(2);
    if (nameRows.length === 1) row = nameRows[0];
  }

  if (!row?.slug) return null;
  return {
    ...row,
    slug: row.slug,
    coverImage: coalesceCoverImage(row.coverImage),
  };
}

/**
 * کتاب‌های مرتبط با یک موجودیت: ردیف‌های Book که فیلد متناظرشان با نام موجودیت
 * برابر است. تکراری‌ها (یک کتاب کانونی که چند کاربر اضافه کرده‌اند) بر اساس
 * هویت کاتالوگ یکتا می‌شوند تا هر کتاب فقط یک‌بار دیده شود.
 */
export async function getReferenceBooks(
  type: ReferenceTypeValue,
  name: string
): Promise<ReferenceBookCard[]> {
  const field = FIELD_BY_TYPE[type];
  const where =
    type === "GENRE"
      ? sql`exists (
          select 1
          from unnest(string_to_array(coalesce(${field}, ''), ${STORED_GENRE_SEPARATOR})) as genre_value
          where lower(trim(genre_value)) = lower(${name})
        )`
      : sql`lower(${field}) = lower(${name})`;
  const rows = await db
    .select({
      id: Book.id,
      slug: Book.slug,
      title: Book.title,
      author: Book.author,
      translator: Book.translator,
      publisher: Book.publisher,
      coverImage: Book.coverImage,
      rating: Book.rating,
      createdAt: Book.createdAt,
      catalogBookId: Book.catalogBookId,
    })
    .from(Book)
    .where(where)
    .orderBy(desc(Book.createdAt));

  const seen = new Set<string>();
  const out: ReferenceBookCard[] = [];
  for (const row of rows) {
    const key = row.catalogBookId ?? row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      author: row.author,
      translator: row.translator,
      publisher: row.publisher,
      coverImage: coalesceCoverImage(row.coverImage),
      rating: row.rating,
      createdAt: row.createdAt,
    });
  }

  const catalogBookIds = out
    .map((row) => rows.find((item) => item.id === row.id)?.catalogBookId ?? null)
    .filter((value): value is string => Boolean(value));

  if (catalogBookIds.length === 0) return out;

  const catalogRows = await db
    .select({
      id: CatalogBook.id,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      author: CatalogBook.author,
      translator: preferredEditionFieldSql<string | null>("translator"),
      publisher: preferredEditionFieldSql<string | null>("publisher"),
      coverImage: displayCoverFieldSql(),
    })
    .from(CatalogBook)
    .where(inArray(CatalogBook.id, catalogBookIds));

  const catalogMap = new Map(catalogRows.map((row) => [row.id, row]));

  return out.map((row) => {
    const source = rows.find((item) => item.id === row.id);
    const catalogRow = source?.catalogBookId
      ? catalogMap.get(source.catalogBookId)
      : null;

    if (!catalogRow) return row;

    return {
      ...row,
      id: catalogRow.id,
      slug: catalogRow.slug,
      title: catalogRow.title,
      author: catalogRow.author,
      translator: catalogRow.translator,
      publisher: catalogRow.publisher,
      coverImage: coalesceCoverImage(catalogRow.coverImage),
    };
  });
}
