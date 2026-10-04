CREATE TYPE "CommentTargetType" AS ENUM ('QUOTE', 'NOTE', 'ACTIVITY');
--> statement-breakpoint
CREATE TABLE "SocialComment" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_type" "CommentTargetType" NOT NULL,
  "target_id" varchar NOT NULL,
  "author_user_id" varchar NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "parent_id" varchar REFERENCES "SocialComment"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "SocialComment_content_length_check" CHECK (char_length(btrim("content")) BETWEEN 1 AND 2000),
  CONSTRAINT "SocialComment_no_self_reply_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
--> statement-breakpoint
CREATE INDEX "SocialComment_target_created_idx" ON "SocialComment" ("target_type", "target_id", "created_at");
--> statement-breakpoint
CREATE INDEX "SocialComment_parent_idx" ON "SocialComment" ("parent_id");
