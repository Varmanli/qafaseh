CREATE TABLE IF NOT EXISTS "HomeFeaturedReadingList" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reading_list_id" varchar NOT NULL REFERENCES "ReadingList"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "HomeFeaturedReadingList_reading_list_id_unique" UNIQUE("reading_list_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HomeFeaturedReadingList_sort_order_idx" ON "HomeFeaturedReadingList" ("sort_order");
