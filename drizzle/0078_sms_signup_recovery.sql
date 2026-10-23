ALTER TABLE "SmsVerificationCode" DROP CONSTRAINT IF EXISTS "SmsVerificationCode_purpose_check";
--> statement-breakpoint
ALTER TABLE "SmsVerificationCode" ADD CONSTRAINT "SmsVerificationCode_purpose_check" CHECK ("purpose" IN ('login', 'link', 'signup', 'recovery'));
--> statement-breakpoint
ALTER TABLE "PasswordResetToken" ADD COLUMN "verification_method" varchar(5) DEFAULT 'email' NOT NULL CHECK ("verification_method" IN ('email', 'sms'));
