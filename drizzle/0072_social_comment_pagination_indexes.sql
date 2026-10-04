-- IS NULL is not an equality path key: a partial root index avoids a sort.
DROP INDEX "SocialComment_target_created_idx";
--> statement-breakpoint
CREATE INDEX "SocialComment_target_created_idx" ON "SocialComment" ("target_type", "target_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX "SocialComment_root_created_idx" ON "SocialComment" ("target_type", "target_id", "created_at", "id") WHERE "parent_id" IS NULL;
--> statement-breakpoint
DROP INDEX "SocialComment_parent_idx";
--> statement-breakpoint
CREATE INDEX "SocialComment_parent_idx" ON "SocialComment" ("parent_id", "created_at", "id");
