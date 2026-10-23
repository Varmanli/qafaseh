ALTER TABLE "User" ADD COLUMN "phone" varchar(16);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "phone_verified" timestamp;
--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_phone_unique" UNIQUE("phone");
--> statement-breakpoint
CREATE TABLE "SmsVerificationCode" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" varchar(16) NOT NULL,
  "purpose" varchar(10) NOT NULL CHECK ("purpose" IN ('login', 'link')),
  "user_id" varchar REFERENCES "User"("id") ON DELETE CASCADE,
  "code_hash" varchar(64) NOT NULL,
  "delivery_accepted" boolean DEFAULT false NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "SmsVerificationCode_phone_purpose_idx" ON "SmsVerificationCode" ("phone", "purpose", "created_at");
--> statement-breakpoint
ALTER TABLE "VerificationCode" ADD COLUMN "delivery_accepted" boolean DEFAULT true NOT NULL;
