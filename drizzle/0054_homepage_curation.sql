CREATE TABLE IF NOT EXISTS "HomeFeaturedAuthor" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" varchar NOT NULL REFERENCES "ReferenceItem"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "HomeFeaturedAuthor_author_id_unique" UNIQUE("author_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HomeFeaturedAuthor_sort_order_idx" ON "HomeFeaturedAuthor" ("sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "HomeFeaturedBlogPost" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blog_post_id" varchar NOT NULL REFERENCES "BlogPost"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "HomeFeaturedBlogPost_blog_post_id_unique" UNIQUE("blog_post_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HomeFeaturedBlogPost_sort_order_idx" ON "HomeFeaturedBlogPost" ("sort_order");
