CREATE TABLE IF NOT EXISTS "ReadingListCategory" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "ReadingList"
SET "category" = btrim("category")
WHERE "category" <> btrim("category");
--> statement-breakpoint
INSERT INTO "ReadingListCategory" ("name")
SELECT DISTINCT btrim("category")
FROM "ReadingList"
WHERE btrim("category") <> ''
ON CONFLICT ("name") DO NOTHING;
