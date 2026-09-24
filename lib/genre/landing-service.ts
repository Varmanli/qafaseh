import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { CatalogBook, ReferenceItem } from "@/db/schema";
import { displayCoverFieldSql } from "@/lib/book/display-cover";
import { catalogGenreContains } from "@/lib/genre/query";
import { publicPersonBookRoles } from "@/lib/reference/book-contributions";

const genreMatch = (name: string) => catalogGenreContains(CatalogBook.genre, name);

export type GenreLandingBook = { id: string; slug: string | null; title: string; author: string; coverImage: string | null };

export async function getGenreLandingData(genre: { id: string; name: string }) {
  const condition = and(eq(CatalogBook.status, "APPROVED"), genreMatch(genre.name));
  const [topBooks, moreBooks, authors, relatedGenres, countRows] = await Promise.all([
    db.select({ id: CatalogBook.id, slug: CatalogBook.slug, title: CatalogBook.title, author: CatalogBook.author, coverImage: displayCoverFieldSql() }).from(CatalogBook).where(condition).orderBy(desc(CatalogBook.updatedAt), desc(CatalogBook.createdAt)).limit(6),
    db.select({ id: CatalogBook.id, slug: CatalogBook.slug, title: CatalogBook.title, author: CatalogBook.author, coverImage: displayCoverFieldSql() }).from(CatalogBook).where(condition).orderBy(desc(CatalogBook.createdAt)).offset(6).limit(6),
    db.execute<{ id: string; name: string; slug: string; coverImage: string | null; bookCount: number }>(sql`
      SELECT r.id, r.name, r.slug, r.cover_image AS "coverImage",
        count(DISTINCT cb.id)::int AS "bookCount"
      FROM (${publicPersonBookRoles}) person_books
      JOIN "CatalogBook" cb ON cb.id = person_books.catalog_book_id
      JOIN "ReferenceItem" r ON r.id = person_books.reference_item_id
      WHERE cb.status = 'APPROVED' AND ${catalogGenreContains(sql`cb.genre`, genre.name)}
        AND r.type = 'AUTHOR' AND r.status = 'APPROVED' AND r.slug IS NOT NULL
      GROUP BY r.id
      ORDER BY "bookCount" DESC, r.name ASC
      LIMIT 6
    `),
    db.select({ id: ReferenceItem.id, name: ReferenceItem.name, slug: ReferenceItem.slug }).from(ReferenceItem).where(and(eq(ReferenceItem.type, "GENRE"), eq(ReferenceItem.status, "APPROVED"), isNotNull(ReferenceItem.slug), sql`lower(${ReferenceItem.name}) <> lower(${genre.name})`, sql`exists (select 1 from "CatalogBook" book where book.status = 'APPROVED' and exists (select 1 from regexp_split_to_table(coalesce(book.genre, ''), E'[\\n\\r،,;؛•]+') current_value where lower(trim(current_value)) = lower(${genre.name})) and exists (select 1 from regexp_split_to_table(coalesce(book.genre, ''), E'[\\n\\r،,;؛•]+') related_value where lower(trim(related_value)) = lower(${ReferenceItem.name})))`)).orderBy(desc(ReferenceItem.updatedAt), asc(ReferenceItem.name)).limit(6),
    db.select({ total: sql<number>`count(*)::int` }).from(CatalogBook).where(condition),
  ]);
  return { topBooks, moreBooks, authors: authors.rows, relatedGenres: relatedGenres.map((row) => ({ ...row, slug: row.slug! })), bookCount: countRows[0]?.total ?? 0 };
}
