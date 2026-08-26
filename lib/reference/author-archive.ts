import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { AuthorArchiveFilters, AuthorArchiveSort } from "@/lib/reference/author-archive-search";

export interface AuthorArchiveItem {
  id: string; name: string; slug: string | null; coverImage: string | null;
  countryName: string | null; bookCount: number; averageRating: number | null; ratingCount: number;
}
export interface AuthorArchiveResult { items: AuthorArchiveItem[]; countries: string[]; totalCount: number; page: number; pageSize: number; pageCount: number; }
type RawResult<T> = { rows: T[] };
async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> { return (await db.execute(statement) as unknown as RawResult<T>).rows; }

const orderBy: Record<AuthorArchiveSort, ReturnType<typeof sql>> = {
  TOP: sql`"topScore" DESC, "bookCount" DESC, "ratingCount" DESC, "name" ASC`,
  MOST_BOOKS: sql`"bookCount" DESC, "ratingCount" DESC, "name" ASC`,
  HIGHEST_RATED: sql`"weightedRating" DESC, "ratingCount" DESC, "bookCount" DESC, "name" ASC`,
  MOST_POPULAR: sql`"ratingCount" DESC, "bookCount" DESC, "name" ASC`,
  NEWEST: sql`"createdAt" DESC, "name" ASC`, OLDEST: sql`"createdAt" ASC, "name" ASC`,
  NAME_ASC: sql`"name" ASC`, NAME_DESC: sql`"name" DESC`,
};

/** Database-backed author archive. Ratings are library ratings attached to linked catalog books. */
export async function getAuthorArchive(filters: AuthorArchiveFilters, pageSize: number): Promise<AuthorArchiveResult> {
  const safeSize = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const term = filters.q.trim();
  const where = sql`
    1 = 1
    ${term ? sql`AND "name" ILIKE ${`%${term}%`}` : sql``}
    ${filters.country ? sql`AND "countryName" = ${filters.country}` : sql``}
    ${filters.minBooks ? sql`AND "bookCount" >= ${filters.minBooks}` : sql``}
    ${filters.minRating ? sql`AND "averageRating" >= ${filters.minRating}` : sql``}`;
  const statement = sql`
    WITH author_book_links AS (
      SELECT cbc."reference_item_id", cbc."catalog_book_id"
      FROM "CatalogBookContributor" cbc
      JOIN "CatalogBook" cb ON cb."id" = cbc."catalog_book_id" AND cb."status" = 'APPROVED'
      WHERE cbc."role" = 'AUTHOR'
      UNION
      SELECT r."id" AS "reference_item_id", cb."id" AS "catalog_book_id"
      FROM "ReferenceItem" r
      JOIN "CatalogBook" cb ON lower(cb."author") = lower(r."name") AND cb."status" = 'APPROVED'
      WHERE r."type" = 'AUTHOR'
        AND r."status" = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1
          FROM "CatalogBookContributor" cbc
          WHERE cbc."catalog_book_id" = cb."id" AND cbc."role" = 'AUTHOR'
        )
    ), author_stats AS (
      SELECT abl."reference_item_id" AS id,
        count(DISTINCT cb."id")::int AS "bookCount",
        round(avg(b."rating") FILTER (WHERE b."rating" BETWEEN 1 AND 5), 1)::float AS "averageRating",
        count(b."rating") FILTER (WHERE b."rating" BETWEEN 1 AND 5)::int AS "ratingCount"
      FROM author_book_links abl
      JOIN "CatalogBook" cb ON cb."id" = abl."catalog_book_id"
      LEFT JOIN "Book" b ON b."catalog_book_id" = cb."id"
      GROUP BY abl."reference_item_id"
    ), global_rating AS (
      SELECT coalesce(avg("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5), 0)::float AS value FROM "Book"
    ), candidates AS (
      SELECT r."id", r."name", r."slug", r."cover_image" AS "coverImage", r."country_name" AS "countryName", r."created_at" AS "createdAt",
        coalesce(s."bookCount", 0)::int AS "bookCount", s."averageRating", coalesce(s."ratingCount", 0)::int AS "ratingCount",
        (coalesce(s."ratingCount", 0)::float / (coalesce(s."ratingCount", 0) + 5) * coalesce(s."averageRating", g.value) + 5::float / (coalesce(s."ratingCount", 0) + 5) * g.value) AS "weightedRating"
      FROM "ReferenceItem" r LEFT JOIN author_stats s ON s.id = r."id" CROSS JOIN global_rating g
      WHERE r."status" = 'APPROVED' AND r."type" = 'AUTHOR'
    ), filtered AS (SELECT * FROM candidates WHERE ${where}), bounds AS (
      SELECT greatest(max("bookCount"), 1)::float AS books, greatest(max("ratingCount"), 1)::float AS ratings FROM filtered
    ), ranked AS (
      SELECT filtered.*, (
        0.45 * ln(1 + "bookCount") / ln(1 + bounds.books) +
        0.35 * ("weightedRating" / 5) +
        0.20 * ln(1 + "ratingCount") / ln(1 + bounds.ratings)
      ) AS "topScore" FROM filtered CROSS JOIN bounds
    )
    SELECT *, count(*) OVER()::int AS "totalCount" FROM ranked
    ORDER BY ${orderBy[filters.sort]} LIMIT ${safeSize} OFFSET ${(filters.page - 1) * safeSize}`;
  const rows = await query<AuthorArchiveItem & { totalCount: number }>(statement);
  const totalCount = rows[0]?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / safeSize));
  const countries = await query<{ name: string }>(sql`
    SELECT DISTINCT "country_name" AS name FROM "ReferenceItem"
    WHERE "type" = 'AUTHOR' AND "status" = 'APPROVED' AND "country_name" IS NOT NULL AND "country_name" <> '' ORDER BY 1`);
  return { items: rows, countries: countries.map((row) => row.name), totalCount, page: Math.min(filters.page, pageCount), pageSize: safeSize, pageCount };
}
