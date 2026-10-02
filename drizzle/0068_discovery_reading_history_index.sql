CREATE INDEX IF NOT EXISTS "Book_user_status_catalog_idx"
  ON "Book" ("user_id", "status", "catalog_book_id");
