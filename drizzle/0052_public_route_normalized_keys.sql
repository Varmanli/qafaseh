-- Canonical slugs remain untouched for SEO/backward compatibility. These keys
-- support Persian/Arabic-equivalent lookups without making that equivalence a
-- uniqueness constraint (old data may legitimately collide after normalization).
ALTER TABLE "CatalogBook" ADD COLUMN IF NOT EXISTS "slug_normalized" text;
--> statement-breakpoint
ALTER TABLE "ReferenceItem" ADD COLUMN IF NOT EXISTS "slug_normalized" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CatalogBook_slug_normalized_idx" ON "CatalogBook" ("slug_normalized");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReferenceItem_type_slug_normalized_idx" ON "ReferenceItem" ("type", "slug_normalized");
