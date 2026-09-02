-- Begin- en eindtijd per dagdeel, per waarneemgroep.
--
-- Een dagdeel had geen tijd. De tabel dagdelen is globaal, vier rijen voor alle groepen samen,
-- dus daar kan geen tijd bij: de ene groep begint zijn ochtend om acht uur en de andere om
-- zeven uur. Vandaar een eigen tabel per waarneemgroep.
--
-- Een groep die niets invult heeft hier geen rijen. Dat is wat er nu overal staat, en het blijft
-- werken zoals het werkte: een dagdeel zonder tijd is gewoon een dagdeel.
--
-- Er staat met opzet geen controle in dat de begintijd voor de eindtijd ligt. De nacht loopt van
-- 23:00 tot 07:00 en gaat dus over middernacht heen; zo'n rij is geldig.

DO $$
BEGIN
  IF to_regclass('public.praktijkplannerdagdeeltijden') IS NULL THEN
    CREATE TABLE "praktijkplannerdagdeeltijden" (
      "id" serial PRIMARY KEY NOT NULL,
      "idwaarneemgroep" integer NOT NULL REFERENCES "waarneemgroepen"("id") ON DELETE CASCADE,
      "iddagdeel" integer NOT NULL REFERENCES "dagdelen"("id"),
      "begintijd" time NOT NULL,
      "eindtijd" time NOT NULL,
      "updated_by" integer REFERENCES "deelnemers"("id"),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );

    ALTER TABLE "praktijkplannerdagdeeltijden"
      ADD CONSTRAINT "praktijkplannerdagdeeltijden_group_daypart_unique"
      UNIQUE ("idwaarneemgroep", "iddagdeel");

    CREATE INDEX "praktijkplannerdagdeeltijden_group_idx"
      ON "praktijkplannerdagdeeltijden" ("idwaarneemgroep");
  END IF;
END $$;
