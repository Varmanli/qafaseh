CREATE INDEX IF NOT EXISTS "Book_catalog_user_edition_idx"
  ON "Book" ("catalog_book_id", "user_id", "edition_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "BookEdition_catalog_book_id_idx"
  ON "BookEdition" ("catalog_book_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PublishedBookNote_catalog_scope_created_idx"
  ON "PublishedBookNote" ("catalog_book_id", "scope", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReferenceItem_name_lower_idx"
  ON "ReferenceItem" (lower("name"));
