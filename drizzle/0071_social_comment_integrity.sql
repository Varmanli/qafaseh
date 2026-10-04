ALTER TABLE "SocialComment"
  ADD COLUMN "quote_id" varchar,
  ADD COLUMN "note_id" varchar,
  ADD COLUMN "activity_id" varchar,
  ADD COLUMN "request_id" varchar NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();
--> statement-breakpoint
UPDATE "SocialComment" SET "updated_at" = "created_at";
--> statement-breakpoint
-- Keep existing publication-event conversations on the published object.
UPDATE "SocialComment" c
SET "target_type" = CASE WHEN a."quote_id" IS NOT NULL THEN 'QUOTE'::"CommentTargetType" ELSE 'NOTE'::"CommentTargetType" END,
    "target_id" = coalesce(a."quote_id", a."note_id")
FROM "Activity" a
WHERE c."target_type" = 'ACTIVITY' AND c."target_id" = a."id"
  AND (a."quote_id" IS NOT NULL OR a."note_id" IS NOT NULL);
--> statement-breakpoint
-- These rows already have no reachable content; remove them before adding FKs.
DELETE FROM "SocialComment" c WHERE
  (c."target_type" = 'QUOTE' AND NOT EXISTS (SELECT 1 FROM "Quote" q WHERE q."id" = c."target_id")) OR
  (c."target_type" = 'NOTE' AND NOT EXISTS (SELECT 1 FROM "PublishedBookNote" n WHERE n."id" = c."target_id")) OR
  (c."target_type" = 'ACTIVITY' AND NOT EXISTS (SELECT 1 FROM "Activity" a WHERE a."id" = c."target_id"));
--> statement-breakpoint
UPDATE "SocialComment" SET
  "quote_id" = CASE WHEN "target_type" = 'QUOTE' THEN "target_id" END,
  "note_id" = CASE WHEN "target_type" = 'NOTE' THEN "target_id" END,
  "activity_id" = CASE WHEN "target_type" = 'ACTIVITY' THEN "target_id" END;
--> statement-breakpoint
ALTER TABLE "SocialComment"
  DROP CONSTRAINT "SocialComment_parent_id_fkey",
  ADD CONSTRAINT "SocialComment_quote_id_Quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "Quote"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SocialComment_note_id_PublishedBookNote_id_fk" FOREIGN KEY ("note_id") REFERENCES "PublishedBookNote"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SocialComment_activity_id_Activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "SocialComment_author_request_unique" UNIQUE ("author_user_id", "request_id"),
  ADD CONSTRAINT "SocialComment_identity_target_unique" UNIQUE ("id", "target_type", "target_id"),
  ADD CONSTRAINT "SocialComment_parent_target_fk" FOREIGN KEY ("parent_id", "target_type", "target_id") REFERENCES "SocialComment"("id", "target_type", "target_id") ON DELETE CASCADE,
  ADD CONSTRAINT "SocialComment_target_object_check" CHECK (
    ("target_type" = 'QUOTE' AND "quote_id" IS NOT NULL AND "quote_id" = "target_id" AND "note_id" IS NULL AND "activity_id" IS NULL) OR
    ("target_type" = 'NOTE' AND "note_id" IS NOT NULL AND "note_id" = "target_id" AND "quote_id" IS NULL AND "activity_id" IS NULL) OR
    ("target_type" = 'ACTIVITY' AND "activity_id" IS NOT NULL AND "activity_id" = "target_id" AND "quote_id" IS NULL AND "note_id" IS NULL)
  );
--> statement-breakpoint
DROP INDEX "SocialComment_target_created_idx";
--> statement-breakpoint
CREATE INDEX "SocialComment_target_created_idx" ON "SocialComment" ("target_type", "target_id", "parent_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX "SocialComment_author_created_idx" ON "SocialComment" ("author_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "SocialComment_quote_idx" ON "SocialComment" ("quote_id");
--> statement-breakpoint
CREATE INDEX "SocialComment_note_idx" ON "SocialComment" ("note_id");
--> statement-breakpoint
CREATE INDEX "SocialComment_activity_idx" ON "SocialComment" ("activity_id");
--> statement-breakpoint
CREATE FUNCTION "SocialComment_validate_thread"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_parent varchar;
BEGIN
  IF NEW."parent_id" IS NOT NULL THEN
    SELECT "parent_id" INTO parent_parent FROM "SocialComment" WHERE "id" = NEW."parent_id" FOR SHARE;
    IF parent_parent IS NOT NULL OR EXISTS (SELECT 1 FROM "SocialComment" WHERE "parent_id" = NEW."id") THEN
      RAISE EXCEPTION 'Replies must belong to a root comment' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "SocialComment_thread_check" BEFORE INSERT OR UPDATE OF "parent_id" ON "SocialComment"
FOR EACH ROW EXECUTE FUNCTION "SocialComment_validate_thread"();
