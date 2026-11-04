-- Better Auth tables lived in deleted migrations (0003_move_auth_tables_to_public,
-- 0004_create_user_view_for_get_session). The no-op baseline never recreates them,
-- so a restored or fresh database has deelnemers but no account/session tables.
-- IF NOT EXISTS keeps this safe on databases that already have them.

CREATE TABLE IF NOT EXISTS "account" (
  "id" text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session" (
  "id" text NOT NULL PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL
);--> statement-breakpoint

-- public.verification already exists for the app; Better Auth uses this name.
CREATE TABLE IF NOT EXISTS "auth_verification" (
  "id" text NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);--> statement-breakpoint

-- Some Better Auth paths (get-session) join "user". We map that to deelnemers.
CREATE OR REPLACE VIEW "user" AS
SELECT
  id,
  name,
  login AS email,
  COALESCE(email_verified, false) AS "emailVerified",
  image,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  COALESCE(role, 'user') AS role,
  encrypted_password
FROM deelnemers;
