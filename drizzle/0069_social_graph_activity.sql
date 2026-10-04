CREATE TYPE "ActivityType" AS ENUM ('STARTED_READING', 'FINISHED_READING', 'PUBLISHED_NOTE', 'PUBLISHED_QUOTE');
--> statement-breakpoint
CREATE TABLE "Follow" (
  "follower_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "following_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "Follow_no_self_check" CHECK ("follower_id" <> "following_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Follow_pair_unique" ON "Follow" ("follower_id", "following_id");
--> statement-breakpoint
CREATE INDEX "Follow_following_idx" ON "Follow" ("following_id");
--> statement-breakpoint
CREATE TABLE "Activity" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" "ActivityType" NOT NULL,
  "book_id" varchar REFERENCES "Book"("id") ON DELETE CASCADE,
  "note_id" varchar REFERENCES "PublishedBookNote"("id") ON DELETE CASCADE,
  "quote_id" varchar REFERENCES "Quote"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "Activity_object_check" CHECK (
    ("type" IN ('STARTED_READING', 'FINISHED_READING') AND "book_id" IS NOT NULL AND "note_id" IS NULL AND "quote_id" IS NULL)
    OR ("type" = 'PUBLISHED_NOTE' AND "book_id" IS NOT NULL AND "note_id" IS NOT NULL AND "quote_id" IS NULL)
    OR ("type" = 'PUBLISHED_QUOTE' AND "book_id" IS NOT NULL AND "note_id" IS NULL AND "quote_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX "Activity_actor_created_idx" ON "Activity" ("actor_user_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX "Activity_created_idx" ON "Activity" ("created_at", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_note_unique" ON "Activity" ("note_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_quote_unique" ON "Activity" ("quote_id");
