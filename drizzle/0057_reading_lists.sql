DO $$ BEGIN CREATE TYPE "ReadingListMode" AS ENUM ('ORDERED', 'UNORDERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "ReadingListStatus" AS ENUM ('DRAFT', 'PUBLISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "ReadingListDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReadingList" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text NOT NULL,
  "audience" text,
  "category" text NOT NULL,
  "hub_group" text NOT NULL,
  "mode" "ReadingListMode" DEFAULT 'ORDERED' NOT NULL,
  "status" "ReadingListStatus" DEFAULT 'DRAFT' NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReadingListItem" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" varchar NOT NULL REFERENCES "ReadingList"("id") ON DELETE CASCADE,
  "book_id" varchar NOT NULL REFERENCES "CatalogBook"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "note" text,
  "difficulty" "ReadingListDifficulty",
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ReadingListItem_list_book_unique" UNIQUE("list_id", "book_id"),
  CONSTRAINT "ReadingListItem_list_position_unique" UNIQUE("list_id", "position"),
  CONSTRAINT "ReadingListItem_position_positive" CHECK ("position" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReadingListRelated" (
  "source_list_id" varchar NOT NULL REFERENCES "ReadingList"("id") ON DELETE CASCADE,
  "related_list_id" varchar NOT NULL REFERENCES "ReadingList"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  CONSTRAINT "ReadingListRelated_edge_unique" UNIQUE("source_list_id", "related_list_id"),
  CONSTRAINT "ReadingListRelated_not_self" CHECK ("source_list_id" <> "related_list_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReadingList_status_group_idx" ON "ReadingList" ("status", "hub_group");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReadingListRelated_source_idx" ON "ReadingListRelated" ("source_list_id", "position");
