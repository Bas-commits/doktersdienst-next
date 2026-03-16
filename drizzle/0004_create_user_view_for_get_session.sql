-- Some Better Auth code paths (e.g. get-session) may join to "user". We use deelnemers;
-- this view lets those queries resolve in public schema.
CREATE OR REPLACE VIEW public."user" AS
SELECT
  id,
  name,
  login AS email,
  false AS "emailVerified",
  NULL::varchar(255) AS image,
  NULL::timestamptz AS "createdAt",
  NULL::timestamptz AS "updatedAt",
  'user'::varchar(50) AS role,
  encrypted_password
FROM public.deelnemers;
