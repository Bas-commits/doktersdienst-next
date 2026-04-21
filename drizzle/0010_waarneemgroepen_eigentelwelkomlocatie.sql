-- S3 object key (e.g. sounds/mijnbestand_2026-04-20-14-30-45-123.sln) for eigen welkomst-audio
ALTER TABLE "waarneemgroepen" ADD COLUMN IF NOT EXISTS "eigentelwelkomlocatie" varchar(512) NULL;
