-- Staging/isolated local database ONLY. ANALYZE executes the query.
-- Replace example values with representative STAGING IDs and text.
-- Inspect EXPLAIN without ANALYZE first; use a bounded statement_timeout.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT id, COALESCE((
  SELECT array_agg(c.reference_item_id ORDER BY c.reference_item_id)
  FROM "CatalogBookContributor" c
  WHERE c.catalog_book_id = "CatalogBook".id AND c.role = 'AUTHOR'
), ARRAY[]::varchar[]) FROM "CatalogBook" WHERE status = 'APPROVED';

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT id, ARRAY(
  SELECT c.reference_item_id FROM "CatalogBookContributor" c
  WHERE c.catalog_book_id = "CatalogBook".id AND c.role = 'AUTHOR'
  ORDER BY c.reference_item_id
) FROM "CatalogBook" WHERE status = 'APPROVED';

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT id FROM "CatalogBook"
WHERE status = 'APPROVED' AND lower(title) = lower('STAGING_BOOK_TITLE') LIMIT 2;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT catalog_book_id, count(*)::int,
  avg(rating) FILTER (WHERE rating > 0)
FROM "Book" WHERE catalog_book_id IS NOT NULL GROUP BY catalog_book_id;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT count(*)::int, count(*) FILTER (WHERE status = 'READING')::int,
  count(*) FILTER (WHERE is_favorite)::int,
  round(avg(rating) FILTER (WHERE rating > 0), 1)
FROM "Book" WHERE user_id = 'STAGING_USER_ID';
ROLLBACK;
