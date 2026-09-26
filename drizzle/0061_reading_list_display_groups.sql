CREATE TABLE IF NOT EXISTS "ReadingListDisplayGroup" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "ReadingList"
SET "hub_group" = btrim("hub_group")
WHERE "hub_group" <> btrim("hub_group");
--> statement-breakpoint
INSERT INTO "ReadingListDisplayGroup" ("name")
SELECT DISTINCT btrim("hub_group")
FROM "ReadingList"
WHERE btrim("hub_group") <> ''
ON CONFLICT ("name") DO NOTHING;
