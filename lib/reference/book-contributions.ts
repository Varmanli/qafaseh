import { sql } from "drizzle-orm";

/** One public, canonical book/role relation for profiles and every person count.
 * Normalized rows win per role and book (per edition for translators). Legacy
 * names are exact, case-insensitive matches only; they never replace a row.
 */
export const publicPersonBookRoles = sql`
  SELECT cbc.reference_item_id, cbc.catalog_book_id, cbc.role::text AS role
  FROM "CatalogBookContributor" cbc
  JOIN "CatalogBook" cb ON cb.id = cbc.catalog_book_id AND cb.status = 'APPROVED'
  UNION
  SELECT bec.reference_item_id, be.catalog_book_id, bec.role::text AS role
  FROM "BookEditionContributor" bec
  JOIN "BookEdition" be ON be.id = bec.book_edition_id AND be.status = 'APPROVED'
  JOIN "CatalogBook" cb ON cb.id = be.catalog_book_id AND cb.status = 'APPROVED'
  UNION
  SELECT r.id, cb.id, 'AUTHOR' AS role
  FROM "ReferenceItem" r
  JOIN "CatalogBook" cb ON lower(cb.author) = lower(r.name) AND cb.status = 'APPROVED'
  WHERE r.type = 'AUTHOR' AND r.status = 'APPROVED'
    AND NOT EXISTS (SELECT 1 FROM "CatalogBookContributor" cbc
      WHERE cbc.catalog_book_id = cb.id AND cbc.role = 'AUTHOR')
  UNION
  SELECT r.id, be.catalog_book_id, 'TRANSLATOR' AS role
  FROM "ReferenceItem" r
  JOIN "BookEdition" be ON lower(be.translator) = lower(r.name) AND be.status = 'APPROVED'
  JOIN "CatalogBook" cb ON cb.id = be.catalog_book_id AND cb.status = 'APPROVED'
  WHERE r.type = 'TRANSLATOR' AND r.status = 'APPROVED'
    AND NOT EXISTS (SELECT 1 FROM "BookEditionContributor" bec
      WHERE bec.book_edition_id = be.id AND bec.role = 'TRANSLATOR')
    AND NOT EXISTS (SELECT 1 FROM "CatalogBookContributor" cbc
      WHERE cbc.catalog_book_id = cb.id AND cbc.role = 'TRANSLATOR')
`;

export const personBookCondition = (referenceId: string) => sql`exists (
  select 1 from (${publicPersonBookRoles}) person_books
  where person_books.reference_item_id = ${referenceId}
    and person_books.catalog_book_id = "CatalogBook"."id"
)`;
