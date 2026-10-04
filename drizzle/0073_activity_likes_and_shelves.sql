-- Replace the enum atomically so the new values can also be used by this migration.
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_object_check";
--> statement-breakpoint
DROP INDEX "Activity_note_unique";
--> statement-breakpoint
DROP INDEX "Activity_quote_unique";
--> statement-breakpoint
CREATE TYPE "ActivityTypeExpanded" AS ENUM (
  'STARTED_READING', 'FINISHED_READING', 'PUBLISHED_NOTE', 'PUBLISHED_QUOTE',
  'WANT_TO_READ', 'ADDED_FINISHED', 'PAUSED_READING', 'STOPPED_READING',
  'FAVORITED_BOOK', 'LIKED_NOTE', 'LIKED_QUOTE'
);
--> statement-breakpoint
ALTER TABLE "Activity" ALTER COLUMN "type" TYPE "ActivityTypeExpanded" USING "type"::text::"ActivityTypeExpanded";
--> statement-breakpoint
DROP TYPE "ActivityType";
--> statement-breakpoint
ALTER TYPE "ActivityTypeExpanded" RENAME TO "ActivityType";
--> statement-breakpoint
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_object_check" CHECK (
  ("type" IN ('STARTED_READING', 'FINISHED_READING', 'WANT_TO_READ', 'ADDED_FINISHED', 'PAUSED_READING', 'STOPPED_READING', 'FAVORITED_BOOK') AND "book_id" IS NOT NULL AND "note_id" IS NULL AND "quote_id" IS NULL)
  OR ("type" = 'PUBLISHED_NOTE' AND "book_id" IS NOT NULL AND "note_id" IS NOT NULL AND "quote_id" IS NULL)
  OR ("type" = 'PUBLISHED_QUOTE' AND "book_id" IS NOT NULL AND "note_id" IS NULL AND "quote_id" IS NOT NULL)
  OR ("type" = 'LIKED_NOTE' AND "note_id" IS NOT NULL AND "quote_id" IS NULL)
  OR ("type" = 'LIKED_QUOTE' AND "note_id" IS NULL AND "quote_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_note_unique" ON "Activity" ("note_id") WHERE "type" = 'PUBLISHED_NOTE';
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_quote_unique" ON "Activity" ("quote_id") WHERE "type" = 'PUBLISHED_QUOTE';
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_liked_note_unique" ON "Activity" ("actor_user_id", "note_id") WHERE "type" = 'LIKED_NOTE';
--> statement-breakpoint
CREATE UNIQUE INDEX "Activity_liked_quote_unique" ON "Activity" ("actor_user_id", "quote_id") WHERE "type" = 'LIKED_QUOTE';
--> statement-breakpoint
CREATE TABLE "ActivityLike" (
  "activity_id" varchar NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ActivityLike_activity_user_unique" ON "ActivityLike" ("activity_id", "user_id");
--> statement-breakpoint
-- Existing likes retain their original timestamps; private profiles stay hidden.
INSERT INTO "Activity" ("actor_user_id", "type", "book_id", "quote_id", "created_at")
SELECT l."user_id", 'LIKED_QUOTE', q."book_id", q."id", l."created_at"
FROM "QuoteLike" l JOIN "Quote" q ON q."id" = l."quote_id"
JOIN "User" actor ON actor."id" = l."user_id" AND actor."profile_visibility" = 'PUBLIC'
JOIN "User" owner ON owner."id" = q."user_id" AND owner."profile_visibility" = 'PUBLIC'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "Activity" ("actor_user_id", "type", "book_id", "note_id", "created_at")
SELECT l."user_id", 'LIKED_NOTE', n."book_id", n."id", l."created_at"
FROM "PublishedBookNoteLike" l JOIN "PublishedBookNote" n ON n."id" = l."note_id"
JOIN "User" actor ON actor."id" = l."user_id" AND actor."profile_visibility" = 'PUBLIC'
JOIN "User" owner ON owner."id" = n."user_id" AND owner."profile_visibility" = 'PUBLIC'
ON CONFLICT DO NOTHING;
