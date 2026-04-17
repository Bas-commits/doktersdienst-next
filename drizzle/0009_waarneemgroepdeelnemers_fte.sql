-- FTE per deelnemer per waarneemgroep (Mijn gegevens), range 0–2
ALTER TABLE waarneemgroepdeelnemers ADD COLUMN IF NOT EXISTS fte double precision DEFAULT 0.0;
