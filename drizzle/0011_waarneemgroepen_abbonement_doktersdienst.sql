ALTER TABLE "waarneemgroepen"
  ADD COLUMN IF NOT EXISTS "abbonement_doktersdienst" boolean NULL,
  ADD COLUMN IF NOT EXISTS "laatst_aangemeld_doktersdienst" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "laasts_afgemeld_doktersidenst" timestamp NULL;
