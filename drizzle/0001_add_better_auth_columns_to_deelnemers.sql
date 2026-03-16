-- Add Better Auth default user columns to deelnemers (nullable for existing rows)
ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "email_verified" boolean;
ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "image" varchar(255);
ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "created_at" timestamp;
ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "deelnemers" ADD COLUMN IF NOT EXISTS "role" varchar(50);
