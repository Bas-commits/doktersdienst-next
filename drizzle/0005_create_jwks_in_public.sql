-- JWT plugin uses jwks table; create in public (auth schema was removed).
-- Plugin will generate key pair on first use if table is empty.
CREATE TABLE IF NOT EXISTS public.jwks (
  id text NOT NULL PRIMARY KEY,
  "publicKey" text NOT NULL,
  "privateKey" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "expiresAt" timestamptz
);

-- If jwks existed in auth schema, copy and drop (run manually if needed):
-- INSERT INTO public.jwks SELECT * FROM auth.jwks ON CONFLICT (id) DO NOTHING;
-- DROP TABLE IF EXISTS auth.jwks;
