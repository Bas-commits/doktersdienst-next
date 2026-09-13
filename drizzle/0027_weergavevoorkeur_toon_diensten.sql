-- Onthoud of iemand Avond/Nacht en Weekend automatisch laat tonen zodra er een dienst in staat.
--
-- De knop ernaast (+ Diensten) doet zelf niets bewaren aan wat er getoond wordt: hij zet de
-- stand van deze knop om, en die stand bepaalt of Avond/Nacht en het weekend meekomen wanneer
-- er daadwerkelijk een dienst in die dagdelen of dagen staat. Zelfde tabel, zelfde patroon als
-- toon_nacht en toon_weekend.
--
-- Default false: zonder rij staat de knop uit, net als toon_nacht. Wie diensten plant zet hem
-- aan en onthoudt dat per deelnemer en waarneemgroep, zoals de andere twee knoppen ook doen.
ALTER TABLE "praktijkplannerweergavevoorkeuren"
  ADD COLUMN IF NOT EXISTS "toon_diensten" boolean DEFAULT false NOT NULL;
