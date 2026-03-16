-- Index for GET /api/diensten: filter by idwaarneemgroep and date range (van, tot).
-- Speeds up list queries that use vanGte, totLte, idwaarneemgroepIn.

CREATE INDEX IF NOT EXISTS "diensten_list_idx" ON public.diensten (idwaarneemgroep, van, tot);
