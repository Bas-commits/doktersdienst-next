-- Allow auth.account to reference users from public.deelnemers instead of auth.user.
-- Run once: psql "$DATABASE_URL" -f drizzle/0002_auth_account_drop_user_fk.sql
ALTER TABLE auth.account DROP CONSTRAINT IF EXISTS account_userId_fkey;
