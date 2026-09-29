ALTER TYPE "PurchasePriority" RENAME TO "PurchasePriority_old";
--> statement-breakpoint
CREATE TYPE "PurchasePriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
--> statement-breakpoint
ALTER TABLE "Wishlist" ALTER COLUMN "priority" TYPE "PurchasePriority" USING (
  CASE "priority"::text
    WHEN 'MUST_HAVE' THEN 'HIGH'
    WHEN 'WANT_IT' THEN 'HIGH'
    WHEN 'NICE_TO_HAVE' THEN 'MEDIUM'
    ELSE 'LOW'
  END
)::"PurchasePriority";
--> statement-breakpoint
DROP TYPE "PurchasePriority_old";
--> statement-breakpoint
ALTER TABLE "Wishlist" ADD COLUMN "catalog_book_id" varchar REFERENCES "CatalogBook"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "Wishlist_user_catalog_unique" ON "Wishlist" ("user_id", "catalog_book_id");
--> statement-breakpoint
CREATE TABLE "BookLoan" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "book_id" varchar REFERENCES "Book"("id") ON DELETE SET NULL,
  "book_title" text NOT NULL,
  "book_author" text NOT NULL,
  "borrower_name" text NOT NULL,
  "loaned_at" timestamp NOT NULL,
  "due_at" timestamp,
  "returned_at" timestamp,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "BookLoan_user_idx" ON "BookLoan" ("user_id", "returned_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "BookLoan_active_book_unique" ON "BookLoan" ("book_id") WHERE "returned_at" IS NULL;
