ALTER TABLE "CatalogBook" ADD COLUMN IF NOT EXISTS "discovery_text" text
  GENERATED ALWAYS AS (
    qafaseh_discovery_text(coalesce("genre", '') || ' ' || coalesce("description", ''))
  ) STORED;
--> statement-breakpoint
DROP INDEX IF EXISTS "CatalogBook_discovery_text_idx";
--> statement-breakpoint
CREATE INDEX "CatalogBook_discovery_text_idx"
  ON "CatalogBook" USING gin ("discovery_text" gin_trgm_ops)
  WHERE "status" = 'APPROVED';
