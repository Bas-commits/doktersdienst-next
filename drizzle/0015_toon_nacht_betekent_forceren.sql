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
ALTER TABLE "praktijkplannerweergavevoorkeuren" ALTER COLUMN "toon_nacht" SET DEFAULT false;
UPDATE "praktijkplannerweergavevoorkeuren" SET "toon_nacht" = false;

-- toon_dag heeft geen betekenis meer: ochtend en middag zijn niet uit te zetten. De kolom
-- blijft staan omdat hem weggooien een tweede migratie waard is en niets oplevert.
