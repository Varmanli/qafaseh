-- OPTIONAL: review staging EXPLAIN plans and existing index definitions first.
-- Not in Drizzle's journal: never applied by db:migrate or the container entrypoint.
-- Run individually, outside a transaction. No application rows are changed.
SET lock_timeout = '3s';
SET statement_timeout = '10min';

-- Existing catalog/reference/role unique index already helps. This smaller partial
-- index is only worthwhile if AUTHOR lookups dominate real discovery plans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogBookContributor_author_lookup_idx"
  ON "CatalogBookContributor" (catalog_book_id, reference_item_id)
  WHERE role = 'AUTHOR';

-- Public legacy URL fallback compares lower(title); the slug index cannot help it.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogBook_approved_title_lower_idx"
  ON "CatalogBook" (lower(title)) WHERE status = 'APPROVED';

RESET statement_timeout;
RESET lock_timeout;
