-- Onthoud of iemand het weekend uit de roosters laat.
--
-- De knop ernaast, avond en nacht tonen, wordt hier al bewaard per deelnemer en waarneemgroep.
-- Twee knoppen naast elkaar waarvan de ene zijn stand onthoudt en de andere niet, is een
-- verschil dat niemand kan verklaren en dat je elke ochtend opnieuw merkt.
--
-- Toon_weekend en niet verberg_weekend, want de twee kolommen ernaast heten ook toon_. Default
-- true: het weekend staat er nu, en een bestaande rij mag door deze migratie geen twee kolommen
-- kwijtraken. Dat toon_nacht wel op false staat is geen tegenspraak; die kolom betekent sinds
-- migratie 0015 iets anders, namelijk "houd die rijen ook in beeld als ze leeg zijn".
--
-- Not null met een default en niet nullable: er is geen derde stand. Null zou "nog niet gekozen"
-- betekenen, en dat is voor deze vraag hetzelfde als weekend tonen.
ALTER TABLE "praktijkplannerweergavevoorkeuren"
  ADD COLUMN IF NOT EXISTS "toon_weekend" boolean DEFAULT true NOT NULL;
