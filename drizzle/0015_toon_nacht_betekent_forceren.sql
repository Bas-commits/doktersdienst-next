-- toon_nacht betekende "laat avond en nacht zien" en stond standaard aan, want het rooster
-- toonde alle vier de dagdelen altijd. Voortaan verschijnen avond en nacht vanzelf zodra er
-- iets in staat, en betekent de kolom nog maar één ding: houd die twee rijen ook in beeld als
-- ze leeg zijn, zodat er een eerste avond in te plannen valt.
--
-- Dat is een andere vraag dan de oude, dus de oude antwoorden gelden niet meer. Ze op true
-- laten staan zou betekenen dat iedereen die het scherm ooit heeft geopend de lege rijen
-- blijft zien en van deze wijziging niets merkt. De drie bestaande rijen komen uit de
-- vinkjes die in commit de6b55c uit het scherm zijn gehaald; niemand heeft ze sindsdien
-- bewust gezet.
DO $$
BEGIN
  -- Only rewrite existing rows the first time. After the default is already false,
  -- this migration may run again on databases that applied 0015 outside the journal.
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'praktijkplannerweergavevoorkeuren'
       AND column_name = 'toon_nacht'
       AND column_default LIKE '%true%'
  ) THEN
    UPDATE "praktijkplannerweergavevoorkeuren" SET "toon_nacht" = false;
  END IF;
END $$;
ALTER TABLE "praktijkplannerweergavevoorkeuren" ALTER COLUMN "toon_nacht" SET DEFAULT false;

-- toon_dag heeft geen betekenis meer: ochtend en middag zijn niet uit te zetten. De kolom
-- blijft staan omdat hem weggooien een tweede migratie waard is en niets oplevert.
