-- Merge reactions on content events into the original content, one per user.
INSERT INTO "QuoteLike" ("quote_id", "user_id", "created_at")
SELECT a."quote_id", l."user_id", min(l."created_at")
FROM "ActivityLike" l JOIN "Activity" a ON a."id" = l."activity_id"
WHERE a."quote_id" IS NOT NULL
GROUP BY a."quote_id", l."user_id"
ON CONFLICT ("quote_id", "user_id") DO UPDATE
SET "created_at" = least("QuoteLike"."created_at", excluded."created_at");
--> statement-breakpoint
INSERT INTO "PublishedBookNoteLike" ("note_id", "user_id", "created_at")
SELECT a."note_id", l."user_id", min(l."created_at")
FROM "ActivityLike" l JOIN "Activity" a ON a."id" = l."activity_id"
WHERE a."note_id" IS NOT NULL
GROUP BY a."note_id", l."user_id"
ON CONFLICT ("note_id", "user_id") DO UPDATE
SET "created_at" = least("PublishedBookNoteLike"."created_at", excluded."created_at");
--> statement-breakpoint
DELETE FROM "ActivityLike" l USING "Activity" a
WHERE l."activity_id" = a."id" AND (a."quote_id" IS NOT NULL OR a."note_id" IS NOT NULL);
--> statement-breakpoint
-- Newly merged likes remain visible in public readers' recent activity.
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
