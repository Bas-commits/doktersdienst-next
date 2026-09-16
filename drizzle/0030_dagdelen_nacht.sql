-- "Nacht" hoort al sinds jaar en dag bij dagdelen (naast Ochtend/Middag/Avond), maar heeft nooit
-- in een migratie gestaan: 0005_cute_sasquatch.sql zaaide dagdelen destijds met maar drie rijen.
-- Een verse/herstelde database mist "Nacht" daardoor stilletjes, terwijl bestaande databases die
-- ooit los van de migraties zijn bijgewerkt hem wel hebben. Met ON CONFLICT DO NOTHING is dit
-- voor beide veilig opnieuw te draaien.
INSERT INTO "dagdelen" ("id", "naam", "volgorde") VALUES
	(4, 'Nacht', 4)
ON CONFLICT ("id") DO NOTHING;
