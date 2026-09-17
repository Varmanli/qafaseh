DO $$ BEGIN
  CREATE TYPE "IranKetabPublisherImportStatus" AS ENUM('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "IranKetabDiscoverySource"
  ADD COLUMN IF NOT EXISTS "publisher_import_status" "IranKetabPublisherImportStatus" DEFAULT 'IDLE' NOT NULL;
ALTER TABLE "IranKetabDiscoverySource"
  ADD COLUMN IF NOT EXISTS "publisher_import_started_at" timestamp;
ALTER TABLE "IranKetabDiscoverySource"
  ADD COLUMN IF NOT EXISTS "publisher_import_completed_at" timestamp;

WITH candidates AS (
  SELECT source."id",
         row_number() OVER (ORDER BY source."updated_at" DESC, source."id") AS position
  FROM "IranKetabDiscoverySource" AS source
  WHERE source."source_type" = 'PUBLISHER'
    AND source."import_mode" = 'AUTO_IMPORT'
    AND EXISTS (
      SELECT 1
      FROM "IranKetabDiscoveryImportJob" AS job
      WHERE job."discovery_source_id" = source."id"
        AND job."status" IN ('PENDING', 'PROCESSING')
    )
)
UPDATE "IranKetabDiscoverySource" AS source
SET "publisher_import_status" = CASE WHEN candidates.position = 1 THEN 'RUNNING' ELSE 'PAUSED' END::"IranKetabPublisherImportStatus",
    "publisher_import_started_at" = CASE WHEN candidates.position = 1 THEN COALESCE(source."publisher_import_started_at", CURRENT_TIMESTAMP) ELSE source."publisher_import_started_at" END,
    "updated_at" = CURRENT_TIMESTAMP
FROM candidates
WHERE source."id" = candidates."id";

UPDATE "IranKetabDiscoverySource" AS source
SET "publisher_import_status" = 'COMPLETED',
    "publisher_import_completed_at" = COALESCE(source."publisher_import_completed_at", CURRENT_TIMESTAMP),
    "updated_at" = CURRENT_TIMESTAMP
WHERE source."source_type" = 'PUBLISHER'
  AND source."import_mode" = 'AUTO_IMPORT'
  AND source."publisher_import_status" = 'IDLE'
  AND EXISTS (
    SELECT 1 FROM "IranKetabDiscoveryMembership" AS membership
    WHERE membership."discovery_source_id" = source."id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "IranKetabDiscoverySource_one_running_publisher"
  ON "IranKetabDiscoverySource" ("publisher_import_status")
  WHERE "source_type" = 'PUBLISHER' AND "publisher_import_status" = 'RUNNING';
