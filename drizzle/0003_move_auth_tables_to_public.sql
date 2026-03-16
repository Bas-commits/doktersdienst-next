-- Move Better Auth tables from auth schema to public so user (deelnemers), account, session
-- and verification all live in one schema. Fixes 500s from mixed-schema resolution.
-- Run once: psql "$DATABASE_URL" -f drizzle/0003_move_auth_tables_to_public.sql

-- 1. Create public.account (same structure as auth.account)
CREATE TABLE IF NOT EXISTS public.account (
  id text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

-- 2. Create public.session (same structure as auth.session)
CREATE TABLE IF NOT EXISTS public.session (
  id text NOT NULL PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL
);

-- 3. Create public.auth_verification (Better Auth verification; public.verification already exists for app)
CREATE TABLE IF NOT EXISTS public.auth_verification (
  id text NOT NULL PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

-- 4. Copy data from auth schema (only if auth tables still exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'account') THEN
    INSERT INTO public.account SELECT * FROM auth.account ON CONFLICT (id) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'session') THEN
    INSERT INTO public.session SELECT * FROM auth.session ON CONFLICT (id) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'verification') THEN
    INSERT INTO public.auth_verification SELECT * FROM auth.verification ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 5. Drop auth schema tables (order: session, account, verification, user)
DROP TABLE IF EXISTS auth.session;
DROP TABLE IF EXISTS auth.account;
DROP TABLE IF EXISTS auth.verification;
DROP TABLE IF EXISTS auth."user";
