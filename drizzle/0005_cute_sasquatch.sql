-- Prerequisite unique indexes on legacy tables (required for FK references)
CREATE UNIQUE INDEX IF NOT EXISTS "deelnemers_id_unique" ON "deelnemers" ("id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locaties_id_unique" ON "locaties" ("id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waarneemgroepen_id_unique" ON "waarneemgroepen" ("id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taaktypen_id_unique" ON "taaktypen" ("id");--> statement-breakpoint
CREATE TABLE "expertises" (
	"id" serial PRIMARY KEY NOT NULL,
	"naam" varchar(255) NOT NULL,
	"afkorting" varchar(50),
	"idwaarneemgroep" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activiteiten" (
	"id" serial PRIMARY KEY NOT NULL,
	"naam" varchar(255) NOT NULL,
	"afkorting" varchar(50),
	"kleur" varchar(50),
	"icon" varchar(100),
	"idexpertise" integer NOT NULL,
	"idwaarneemgroep" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dagdelen" (
	"id" serial PRIMARY KEY NOT NULL,
	"naam" varchar(50) NOT NULL,
	"volgorde" integer NOT NULL
);
--> statement-breakpoint
INSERT INTO "dagdelen" ("naam", "volgorde") VALUES
	('Ochtend', 1),
	('Middag', 2),
	('Avond', 3);
--> statement-breakpoint
CREATE TABLE "deelnemerexpertises" (
	"iddeelnemer" integer NOT NULL,
	"idexpertise" integer NOT NULL,
	CONSTRAINT "deelnemerexpertises_iddeelnemer_idexpertise_pk" PRIMARY KEY("iddeelnemer","idexpertise")
);
--> statement-breakpoint
CREATE TABLE "planning" (
	"id" serial PRIMARY KEY NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"datum" date NOT NULL,
	"iddagdeel" integer NOT NULL,
	"idactiviteit" integer,
	"idlocatie" integer,
	CONSTRAINT "planning_iddeelnemer_datum_iddagdeel_unique" UNIQUE("iddeelnemer","datum","iddagdeel")
);
--> statement-breakpoint
CREATE TABLE "planningtaak" (
	"idplanning" integer NOT NULL,
	"idtaaktype" integer NOT NULL,
	"positie" smallint NOT NULL,
	CONSTRAINT "planningtaak_idplanning_idtaaktype_pk" PRIMARY KEY("idplanning","idtaaktype"),
	CONSTRAINT "planningtaak_idplanning_positie_unique" UNIQUE("idplanning","positie"),
	CONSTRAINT "planningtaak_positie_check" CHECK ("positie" >= 1 AND "positie" <= 3)
);
--> statement-breakpoint
ALTER TABLE "locaties" ADD COLUMN "idwaarneemgroep" integer;--> statement-breakpoint
ALTER TABLE "activiteiten" ADD CONSTRAINT "activiteiten_idexpertise_expertises_id_fk" FOREIGN KEY ("idexpertise") REFERENCES "public"."expertises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activiteiten" ADD CONSTRAINT "activiteiten_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deelnemerexpertises" ADD CONSTRAINT "deelnemerexpertises_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deelnemerexpertises" ADD CONSTRAINT "deelnemerexpertises_idexpertise_expertises_id_fk" FOREIGN KEY ("idexpertise") REFERENCES "public"."expertises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertises" ADD CONSTRAINT "expertises_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_iddagdeel_dagdelen_id_fk" FOREIGN KEY ("iddagdeel") REFERENCES "public"."dagdelen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_idactiviteit_activiteiten_id_fk" FOREIGN KEY ("idactiviteit") REFERENCES "public"."activiteiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_idlocatie_locaties_id_fk" FOREIGN KEY ("idlocatie") REFERENCES "public"."locaties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningtaak" ADD CONSTRAINT "planningtaak_idplanning_planning_id_fk" FOREIGN KEY ("idplanning") REFERENCES "public"."planning"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningtaak" ADD CONSTRAINT "planningtaak_idtaaktype_taaktypen_id_fk" FOREIGN KEY ("idtaaktype") REFERENCES "public"."taaktypen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activiteiten_idexpertise_idx" ON "activiteiten" USING btree ("idexpertise");--> statement-breakpoint
CREATE INDEX "activiteiten_idwaarneemgroep_idx" ON "activiteiten" USING btree ("idwaarneemgroep");--> statement-breakpoint
CREATE INDEX "expertises_idwaarneemgroep_idx" ON "expertises" USING btree ("idwaarneemgroep");--> statement-breakpoint
CREATE INDEX "planning_datum_iddagdeel_idx" ON "planning" USING btree ("datum","iddagdeel");--> statement-breakpoint
CREATE INDEX "locaties_idwaarneemgroep_idx" ON "locaties" USING btree ("idwaarneemgroep");--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_planningtaak_max_three()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM planningtaak WHERE idplanning = NEW.idplanning) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 tasks per planning slot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER planningtaak_max_three_trigger
BEFORE INSERT ON planningtaak
FOR EACH ROW
EXECUTE FUNCTION check_planningtaak_max_three();
