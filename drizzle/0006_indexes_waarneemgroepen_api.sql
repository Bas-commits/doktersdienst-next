-- Indexes for GET /api/waarneemgroepen performance:
-- 1. session(token) – getSession looks up by token from cookie
-- 2. deelnemers(email) – resolve current user to deelnemer by email

CREATE INDEX IF NOT EXISTS "session_token_idx" ON public.session (token);
CREATE INDEX IF NOT EXISTS "deelnemers_email_idx" ON public.deelnemers (email);
