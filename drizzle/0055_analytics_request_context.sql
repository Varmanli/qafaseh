ALTER TABLE "AnalyticsPageView" ADD COLUMN "ip_address" varchar(128);
ALTER TABLE "AnalyticsPageView" ADD COLUMN "user_agent" text;
ALTER TABLE "AnalyticsPageView" ADD COLUMN "referrer" varchar(1000);
