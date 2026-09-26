CREATE TABLE IF NOT EXISTS "ContactMessage" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "topic" varchar(30) NOT NULL,
  "message" text NOT NULL,
  "book_title" text,
  "book_author" text,
  "book_translator" text,
  "book_reference" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ContactMessage_created_at_idx" ON "ContactMessage" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ContactMessage_unread_idx" ON "ContactMessage" ("is_read", "created_at");
