-- Better Auth maps user.emailVerified to deelnemers.email_verified.
-- The original ALTER lived in 0001_add_better_auth_columns_to_deelnemers.sql
-- and was dropped when the baseline became a no-op. Fresh or restored
-- databases therefore never get this column from migrate.
--
-- Default false: people must verify their email on first login.
-- Rows already true stay true.

ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "deelnemers" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
UPDATE "deelnemers"
   SET "email_verified" = false
 WHERE "email_verified" IS NULL;
