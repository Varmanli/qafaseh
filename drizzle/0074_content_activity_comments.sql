-- Preserve existing content-activity threads on the original quote or note.
-- Updating the whole thread in one statement preserves the composite parent FK.
UPDATE "SocialComment" c
SET "target_type" = CASE WHEN a."quote_id" IS NOT NULL THEN 'QUOTE'::"CommentTargetType" ELSE 'NOTE'::"CommentTargetType" END,
    "target_id" = coalesce(a."quote_id", a."note_id"),
    "quote_id" = a."quote_id",
    "note_id" = CASE WHEN a."quote_id" IS NULL THEN a."note_id" END,
    "activity_id" = NULL
FROM "Activity" a
WHERE c."target_type" = 'ACTIVITY' AND c."target_id" = a."id"
  AND (a."quote_id" IS NOT NULL OR a."note_id" IS NOT NULL);
