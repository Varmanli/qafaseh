CREATE TABLE "SecurityRateLimit" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "SecurityRateLimit_reset_at_idx" ON "SecurityRateLimit" ("reset_at");
