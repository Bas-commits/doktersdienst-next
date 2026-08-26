-- Functies per waarneemgroep.
--
-- Ajo, Specialist, Assisitent en Toa stonden hardcoded in de frontend, en
-- waarneemgroepdeelnemers.idfunctie was een kaal getal dat alleen iets betekende omdat twee
-- bestanden het daarover eens waren. Elke groep zag daardoor dezelfde vier functies, ook als
-- die niet pasten.
--
-- De bestaande rijen worden omgehangen naar de functie van hun eigen groep, zodat niemand zijn
-- functie kwijtraakt. Groepen die de kolom niet gebruiken beginnen leeg; de secretaris vult ze
-- zelf. De spelfout gaat mee: Assisitent wordt Assistent.
--
-- Het geheel staat in een DO-blok dat controleert of de tabel al bestaat. Het omhangen leest de
-- oude waarde van idfunctie en mag daarom precies een keer draaien.

DO $$
BEGIN
  IF to_regclass('public.praktijkplannerfuncties') IS NULL THEN
    CREATE TABLE "praktijkplannerfuncties" (
      "id" serial PRIMARY KEY NOT NULL,
      "idwaarneemgroep" integer NOT NULL REFERENCES "waarneemgroepen"("id") ON DELETE CASCADE,
      "naam" varchar(100) NOT NULL,
      "actief" boolean NOT NULL DEFAULT true,
      "updated_by" integer REFERENCES "deelnemers"("id"),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX "praktijkplannerfuncties_group_naam_unique"
      ON "praktijkplannerfuncties" ("idwaarneemgroep", "naam");
    CREATE INDEX "praktijkplannerfuncties_group_idx"
      ON "praktijkplannerfuncties" ("idwaarneemgroep");

    INSERT INTO "praktijkplannerfuncties" ("idwaarneemgroep", "naam")
    SELECT DISTINCT wd."idwaarneemgroep",
           CASE wd."idfunctie"
             WHEN 1 THEN 'Ajo'
             WHEN 2 THEN 'Specialist'
             WHEN 3 THEN 'Assistent'
             WHEN 4 THEN 'Toa'
           END
    FROM "waarneemgroepdeelnemers" wd
    WHERE wd."idfunctie" BETWEEN 1 AND 4
      AND wd."idwaarneemgroep" IS NOT NULL;

    UPDATE "waarneemgroepdeelnemers" wd
    SET "idfunctie" = f."id"
    FROM "praktijkplannerfuncties" f
    WHERE f."idwaarneemgroep" = wd."idwaarneemgroep"
      AND f."naam" = CASE wd."idfunctie"
                       WHEN 1 THEN 'Ajo'
                       WHEN 2 THEN 'Specialist'
                       WHEN 3 THEN 'Assistent'
                       WHEN 4 THEN 'Toa'
                     END
      AND wd."idfunctie" BETWEEN 1 AND 4;

    -- Een functie die nog bij iemand hangt mag niet zomaar verdwijnen; archiveren kan wel.
    ALTER TABLE "waarneemgroepdeelnemers"
      ADD CONSTRAINT "waarneemgroepdeelnemers_idfunctie_fkey"
      FOREIGN KEY ("idfunctie") REFERENCES "praktijkplannerfuncties"("id") ON DELETE RESTRICT;
  END IF;
END $$;
