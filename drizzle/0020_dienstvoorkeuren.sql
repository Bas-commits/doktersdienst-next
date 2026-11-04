-- Een arts kan per dagdeel aangeven dat hij graag dienst draait, of juist liever niet.
--
-- Dit gaat bewust niet in planningafwezigheden. Die tabel voedt de jaarbalans, en "ik draai
-- graag dienst" zou daar meetellen als opgenomen vrije tijd. Een voorkeur is ook geen
-- afwezigheid: de arts is er juist wel.
--
-- Een voorkeur per moment per arts, afgedwongen door de unieke sleutel en niet door het scherm.
-- Zo doet DoktersDienst het ook (diensten_one_preference_per_slot_user), en daar is het de reden
-- dat je niet tegelijk vakantie en graag dienst kunt opgeven.
--
-- De waarde is tekst en geen code. DoktersDienst gebruikt getallen (2 is liever niet, 3 is
-- liever wel) en niemand kan die query nog lezen zonder het typenoverzicht ernaast.
CREATE TABLE IF NOT EXISTS "praktijkplannerdienstvoorkeuren" (
  "id" serial PRIMARY KEY NOT NULL,
  "idwaarneemgroep" integer NOT NULL REFERENCES "waarneemgroepen"("id"),
  "iddeelnemer" integer NOT NULL REFERENCES "deelnemers"("id"),
  "datum" date NOT NULL,
  "iddagdeel" integer NOT NULL REFERENCES "dagdelen"("id"),
  "voorkeur" varchar(20) NOT NULL,
  "created_by" integer REFERENCES "deelnemers"("id"),
  "updated_by" integer REFERENCES "deelnemers"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "dienstvoorkeuren_voorkeur_check" CHECK ("voorkeur" IN ('graag', 'liever_niet'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "dienstvoorkeuren_deelnemer_datum_dagdeel_unique"
  ON "praktijkplannerdienstvoorkeuren" ("idwaarneemgroep", "iddeelnemer", "datum", "iddagdeel");

CREATE INDEX IF NOT EXISTS "dienstvoorkeuren_groep_datum_idx"
  ON "praktijkplannerdienstvoorkeuren" ("idwaarneemgroep", "datum", "iddagdeel");
