CREATE TABLE "activiteitspecificaties" (
	"id" serial PRIMARY KEY NOT NULL,
	"idactiviteit" integer NOT NULL,
	"naam" varchar(255) NOT NULL,
	"afkorting" varchar(50),
	"kleur" varchar(50),
	"actief" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activiteitspecificaties_activity_naam_unique" UNIQUE("idactiviteit","naam")
);
--> statement-breakpoint
CREATE TABLE "afwezigheidsjaarbudgetten" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"idafwezigheidstype" integer NOT NULL,
	"jaar" integer NOT NULL,
	"beginsaldo" integer DEFAULT 0 NOT NULL,
	"budget" integer DEFAULT 0 NOT NULL,
	"correctie" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "afwezigheidsjaarbudgetten_unique" UNIQUE("idwaarneemgroep","iddeelnemer","idafwezigheidstype","jaar")
);
--> statement-breakpoint
CREATE TABLE "afwezigheidsjaarnotities" (
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"jaar" integer NOT NULL,
	"notitie" text DEFAULT '' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "afwezigheidsjaarnotities_idwaarneemgroep_iddeelnemer_jaar_pk" PRIMARY KEY("idwaarneemgroep","iddeelnemer","jaar")
);
--> statement-breakpoint
CREATE TABLE "afwezigheidstypen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"naam" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"kleur" varchar(50),
	"icon" varchar(100),
	"actief" boolean DEFAULT true NOT NULL,
	CONSTRAINT "afwezigheidstypen_group_code_unique" UNIQUE("idwaarneemgroep","code")
);
--> statement-breakpoint
CREATE TABLE "beschikbaarheidstypen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"naam" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"kleur" varchar(50),
	"icon" varchar(100),
	"type" varchar(30) DEFAULT 'fte' NOT NULL,
	"actief" boolean DEFAULT true NOT NULL,
	CONSTRAINT "beschikbaarheidstypen_group_code_unique" UNIQUE("idwaarneemgroep","code")
);
--> statement-breakpoint
CREATE TABLE "capaciteitsjablonen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"idplannerlocatie" integer NOT NULL,
	"weekdag" smallint NOT NULL,
	"iddagdeel" integer NOT NULL,
	"aantal_deelnemers" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capaciteitsjablonen_group_location_weekday_daypart_unique" UNIQUE("idwaarneemgroep","idplannerlocatie","weekdag","iddagdeel"),
	CONSTRAINT "capaciteitsjablonen_weekdag_check" CHECK ("capaciteitsjablonen"."weekdag" >= 1 AND "capaciteitsjablonen"."weekdag" <= 7),
	CONSTRAINT "capaciteitsjablonen_participants_check" CHECK ("capaciteitsjablonen"."aantal_deelnemers" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capaciteitsjabloonactiviteiten" (
	"idcapaciteitsjabloon" integer NOT NULL,
	"idactiviteit" integer NOT NULL,
	"aantal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capaciteitsjabloonactiviteiten_idcapaciteitsjabloon_idactiviteit_pk" PRIMARY KEY("idcapaciteitsjabloon","idactiviteit"),
	CONSTRAINT "capaciteitsjabloonactiviteiten_count_check" CHECK ("capaciteitsjabloonactiviteiten"."aantal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capaciteitsjabloonexpertises" (
	"idcapaciteitsjabloon" integer NOT NULL,
	"idexpertise" integer NOT NULL,
	"aantal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capaciteitsjabloonexpertises_idcapaciteitsjabloon_idexpertise_pk" PRIMARY KEY("idcapaciteitsjabloon","idexpertise"),
	CONSTRAINT "capaciteitsjabloonexpertises_count_check" CHECK ("capaciteitsjabloonexpertises"."aantal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capaciteitsjabloonspecificaties" (
	"idcapaciteitsjabloon" integer NOT NULL,
	"idactiviteitspecificatie" integer NOT NULL,
	"aantal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capaciteitsjabloonspecificaties_idcapaciteitsjabloon_idactiviteitspecificatie_pk" PRIMARY KEY("idcapaciteitsjabloon","idactiviteitspecificatie"),
	CONSTRAINT "capaciteitsjabloonspecificaties_count_check" CHECK ("capaciteitsjabloonspecificaties"."aantal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capaciteitsjabloontaken" (
	"idcapaciteitsjabloon" integer NOT NULL,
	"idtaaktype" integer NOT NULL,
	"aantal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capaciteitsjabloontaken_idcapaciteitsjabloon_idtaaktype_pk" PRIMARY KEY("idcapaciteitsjabloon","idtaaktype"),
	CONSTRAINT "capaciteitsjabloontaken_count_check" CHECK ("capaciteitsjabloontaken"."aantal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planningafwezigheden" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"datum" date NOT NULL,
	"iddagdeel" integer NOT NULL,
	"idafwezigheidstype" integer NOT NULL,
	"is_voorlopig" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "planningafwezigheden_group_participant_date_daypart_unique" UNIQUE("idwaarneemgroep","iddeelnemer","datum","iddagdeel")
);
--> statement-breakpoint
CREATE TABLE "planningbeschikbaarheid" (
	"idplanning" integer PRIMARY KEY NOT NULL,
	"idbeschikbaarheidstype" integer NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planningherhalingen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"startdatum" date NOT NULL,
	"einddatum" date NOT NULL,
	"frequentie_weken" smallint NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planningherhalingen_frequency_check" CHECK ("planningherhalingen"."frequentie_weken" >= 1 AND "planningherhalingen"."frequentie_weken" <= 3),
	CONSTRAINT "planningherhalingen_range_check" CHECK ("planningherhalingen"."einddatum" >= "planningherhalingen"."startdatum")
);
--> statement-breakpoint
CREATE TABLE "planningherhalingslots" (
	"idherhaling" integer NOT NULL,
	"idplanning" integer NOT NULL,
	"reeksdatum" date NOT NULL,
	"is_bronslot" boolean DEFAULT false NOT NULL,
	CONSTRAINT "planningherhalingslots_idherhaling_idplanning_pk" PRIMARY KEY("idherhaling","idplanning"),
	CONSTRAINT "planningherhalingslots_planning_unique" UNIQUE("idplanning")
);
--> statement-breakpoint
CREATE TABLE "praktijkplanneremaillog" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer,
	"type" varchar(30) NOT NULL,
	"ontvanger" varchar(255) NOT NULL,
	"onderwerp" varchar(255) NOT NULL,
	"resend_id" varchar(255),
	"verstuurd_door" integer,
	"verstuurd_op" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "praktijkplannerlocaties" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"idlocatie" integer,
	"naam" varchar(255) NOT NULL,
	"afkorting" varchar(50),
	"kleur" varchar(50),
	"actief" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "praktijkplannerlocaties_group_naam_unique" UNIQUE("idwaarneemgroep","naam")
);
--> statement-breakpoint
CREATE TABLE "praktijkplannerweergavevoorkeuren" (
	"iddeelnemer" integer NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"toon_dag" boolean DEFAULT true NOT NULL,
	"toon_nacht" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "praktijkplannerweergavevoorkeuren_iddeelnemer_idwaarneemgroep_pk" PRIMARY KEY("iddeelnemer","idwaarneemgroep")
);
--> statement-breakpoint
ALTER TABLE "planning" DROP CONSTRAINT "planning_iddeelnemer_datum_iddagdeel_unique";--> statement-breakpoint
ALTER TABLE "planningtaak" DROP CONSTRAINT "planningtaak_idplanning_planning_id_fk";
--> statement-breakpoint
ALTER TABLE "planningtaak" DROP CONSTRAINT "planningtaak_idtaaktype_taaktypen_id_fk";
--> statement-breakpoint
DROP INDEX "planning_datum_iddagdeel_idx";--> statement-breakpoint
ALTER TABLE "activiteiten" ADD COLUMN "actief" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "expertises" ADD COLUMN "actief" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "idwaarneemgroep" integer;--> statement-breakpoint
UPDATE "planning" AS planning_row
SET "idwaarneemgroep" = deelnemers."idwaarneemgroep"
FROM "deelnemers"
WHERE planning_row."iddeelnemer" = deelnemers."id"
	AND planning_row."idwaarneemgroep" IS NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "planning" WHERE "idwaarneemgroep" IS NULL) THEN
		RAISE EXCEPTION 'Cannot migrate planning rows without a waarneemgroep';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "planning" ALTER COLUMN "idwaarneemgroep" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "idactiviteitspecificatie" integer;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "idplannerlocatie" integer;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "planning" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "activiteitspecificaties" ADD CONSTRAINT "activiteitspecificaties_idactiviteit_activiteiten_id_fk" FOREIGN KEY ("idactiviteit") REFERENCES "public"."activiteiten"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarbudgetten" ADD CONSTRAINT "afwezigheidsjaarbudgetten_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarbudgetten" ADD CONSTRAINT "afwezigheidsjaarbudgetten_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarbudgetten" ADD CONSTRAINT "afwezigheidsjaarbudgetten_idafwezigheidstype_afwezigheidstypen_id_fk" FOREIGN KEY ("idafwezigheidstype") REFERENCES "public"."afwezigheidstypen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarbudgetten" ADD CONSTRAINT "afwezigheidsjaarbudgetten_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarnotities" ADD CONSTRAINT "afwezigheidsjaarnotities_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarnotities" ADD CONSTRAINT "afwezigheidsjaarnotities_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidsjaarnotities" ADD CONSTRAINT "afwezigheidsjaarnotities_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afwezigheidstypen" ADD CONSTRAINT "afwezigheidstypen_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beschikbaarheidstypen" ADD CONSTRAINT "beschikbaarheidstypen_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen" ADD CONSTRAINT "capaciteitsjablonen_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen" ADD CONSTRAINT "capaciteitsjablonen_idplannerlocatie_praktijkplannerlocaties_id_fk" FOREIGN KEY ("idplannerlocatie") REFERENCES "public"."praktijkplannerlocaties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen" ADD CONSTRAINT "capaciteitsjablonen_iddagdeel_dagdelen_id_fk" FOREIGN KEY ("iddagdeel") REFERENCES "public"."dagdelen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen" ADD CONSTRAINT "capaciteitsjablonen_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonactiviteiten" ADD CONSTRAINT "capaciteitsjabloonactiviteiten_idcapaciteitsjabloon_capaciteitsjablonen_id_fk" FOREIGN KEY ("idcapaciteitsjabloon") REFERENCES "public"."capaciteitsjablonen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonactiviteiten" ADD CONSTRAINT "capaciteitsjabloonactiviteiten_idactiviteit_activiteiten_id_fk" FOREIGN KEY ("idactiviteit") REFERENCES "public"."activiteiten"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonexpertises" ADD CONSTRAINT "capaciteitsjabloonexpertises_idcapaciteitsjabloon_capaciteitsjablonen_id_fk" FOREIGN KEY ("idcapaciteitsjabloon") REFERENCES "public"."capaciteitsjablonen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonexpertises" ADD CONSTRAINT "capaciteitsjabloonexpertises_idexpertise_expertises_id_fk" FOREIGN KEY ("idexpertise") REFERENCES "public"."expertises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonspecificaties" ADD CONSTRAINT "capaciteitsjabloonspecificaties_idcapaciteitsjabloon_capaciteitsjablonen_id_fk" FOREIGN KEY ("idcapaciteitsjabloon") REFERENCES "public"."capaciteitsjablonen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloonspecificaties" ADD CONSTRAINT "capaciteitsjabloonspecificaties_idactiviteitspecificatie_activiteitspecificaties_id_fk" FOREIGN KEY ("idactiviteitspecificatie") REFERENCES "public"."activiteitspecificaties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloontaken" ADD CONSTRAINT "capaciteitsjabloontaken_idcapaciteitsjabloon_capaciteitsjablonen_id_fk" FOREIGN KEY ("idcapaciteitsjabloon") REFERENCES "public"."capaciteitsjablonen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capaciteitsjabloontaken" ADD CONSTRAINT "capaciteitsjabloontaken_idtaaktype_taaktypen_id_fk" FOREIGN KEY ("idtaaktype") REFERENCES "public"."taaktypen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_iddagdeel_dagdelen_id_fk" FOREIGN KEY ("iddagdeel") REFERENCES "public"."dagdelen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_idafwezigheidstype_afwezigheidstypen_id_fk" FOREIGN KEY ("idafwezigheidstype") REFERENCES "public"."afwezigheidstypen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_created_by_deelnemers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningafwezigheden" ADD CONSTRAINT "planningafwezigheden_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningbeschikbaarheid" ADD CONSTRAINT "planningbeschikbaarheid_idplanning_planning_id_fk" FOREIGN KEY ("idplanning") REFERENCES "public"."planning"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningbeschikbaarheid" ADD CONSTRAINT "planningbeschikbaarheid_idbeschikbaarheidstype_beschikbaarheidstypen_id_fk" FOREIGN KEY ("idbeschikbaarheidstype") REFERENCES "public"."beschikbaarheidstypen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningbeschikbaarheid" ADD CONSTRAINT "planningbeschikbaarheid_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingen" ADD CONSTRAINT "planningherhalingen_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingen" ADD CONSTRAINT "planningherhalingen_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingen" ADD CONSTRAINT "planningherhalingen_created_by_deelnemers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingen" ADD CONSTRAINT "planningherhalingen_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingslots" ADD CONSTRAINT "planningherhalingslots_idherhaling_planningherhalingen_id_fk" FOREIGN KEY ("idherhaling") REFERENCES "public"."planningherhalingen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningherhalingslots" ADD CONSTRAINT "planningherhalingslots_idplanning_planning_id_fk" FOREIGN KEY ("idplanning") REFERENCES "public"."planning"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplanneremaillog" ADD CONSTRAINT "praktijkplanneremaillog_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplanneremaillog" ADD CONSTRAINT "praktijkplanneremaillog_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplanneremaillog" ADD CONSTRAINT "praktijkplanneremaillog_verstuurd_door_deelnemers_id_fk" FOREIGN KEY ("verstuurd_door") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplannerlocaties" ADD CONSTRAINT "praktijkplannerlocaties_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplannerlocaties" ADD CONSTRAINT "praktijkplannerlocaties_idlocatie_locaties_id_fk" FOREIGN KEY ("idlocatie") REFERENCES "public"."locaties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplannerweergavevoorkeuren" ADD CONSTRAINT "praktijkplannerweergavevoorkeuren_iddeelnemer_deelnemers_id_fk" FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praktijkplannerweergavevoorkeuren" ADD CONSTRAINT "praktijkplannerweergavevoorkeuren_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activiteitspecificaties_activity_idx" ON "activiteitspecificaties" USING btree ("idactiviteit");--> statement-breakpoint
CREATE INDEX "afwezigheidsjaarbudgetten_group_participant_year_idx" ON "afwezigheidsjaarbudgetten" USING btree ("idwaarneemgroep","iddeelnemer","jaar");--> statement-breakpoint
CREATE INDEX "afwezigheidstypen_group_idx" ON "afwezigheidstypen" USING btree ("idwaarneemgroep");--> statement-breakpoint
CREATE INDEX "beschikbaarheidstypen_group_idx" ON "beschikbaarheidstypen" USING btree ("idwaarneemgroep");--> statement-breakpoint
CREATE INDEX "capaciteitsjablonen_group_location_idx" ON "capaciteitsjablonen" USING btree ("idwaarneemgroep","idplannerlocatie");--> statement-breakpoint
CREATE INDEX "planningafwezigheden_group_date_daypart_idx" ON "planningafwezigheden" USING btree ("idwaarneemgroep","datum","iddagdeel");--> statement-breakpoint
CREATE INDEX "planningherhalingen_group_participant_idx" ON "planningherhalingen" USING btree ("idwaarneemgroep","iddeelnemer");--> statement-breakpoint
CREATE INDEX "praktijkplannerlocaties_group_idx" ON "praktijkplannerlocaties" USING btree ("idwaarneemgroep");--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_idwaarneemgroep_waarneemgroepen_id_fk" FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_idactiviteitspecificatie_activiteitspecificaties_id_fk" FOREIGN KEY ("idactiviteitspecificatie") REFERENCES "public"."activiteitspecificaties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_idplannerlocatie_praktijkplannerlocaties_id_fk" FOREIGN KEY ("idplannerlocatie") REFERENCES "public"."praktijkplannerlocaties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_created_by_deelnemers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_updated_by_deelnemers_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningtaak" ADD CONSTRAINT "planningtaak_idplanning_planning_id_fk" FOREIGN KEY ("idplanning") REFERENCES "public"."planning"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planningtaak" ADD CONSTRAINT "planningtaak_idtaaktype_taaktypen_id_fk" FOREIGN KEY ("idtaaktype") REFERENCES "public"."taaktypen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planning_group_date_daypart_idx" ON "planning" USING btree ("idwaarneemgroep","datum","iddagdeel");--> statement-breakpoint
ALTER TABLE "planning" ADD CONSTRAINT "planning_group_participant_date_daypart_unique" UNIQUE("idwaarneemgroep","iddeelnemer","datum","iddagdeel");--> statement-breakpoint
CREATE UNIQUE INDEX "praktijkplannerlocaties_group_legacy_location_unique"
	ON "praktijkplannerlocaties" USING btree ("idwaarneemgroep", "idlocatie")
	WHERE "idlocatie" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dagdelen_volgorde_unique" ON "dagdelen" USING btree ("volgorde");--> statement-breakpoint
INSERT INTO "afwezigheidstypen" ("idwaarneemgroep", "naam", "code", "kleur", "icon")
SELECT
	waarneemgroepen."id",
	default_type."naam",
	default_type."code",
	default_type."kleur",
	default_type."icon"
FROM "waarneemgroepen"
CROSS JOIN (
	VALUES
		('Vakantie', 'vakantie', '#1d4ed8', 'holliday.svg'),
		('Nascholing', 'nascholing', '#7c3aed', 'education.svg'),
		('FTE', 'fte', '#047857', 'FTE.svg'),
		('Compensatie', 'compensatie', '#b45309', 'compensation.svg')
) AS default_type("naam", "code", "kleur", "icon")
WHERE waarneemgroepen."id" IS NOT NULL
ON CONFLICT ("idwaarneemgroep", "code") DO NOTHING;--> statement-breakpoint
INSERT INTO "beschikbaarheidstypen" ("idwaarneemgroep", "naam", "code", "kleur", "icon", "type")
SELECT
	waarneemgroepen."id",
	'FTE',
	'fte',
	'#047857',
	'FTE.svg',
	'fte'
FROM "waarneemgroepen"
WHERE waarneemgroepen."id" IS NOT NULL
ON CONFLICT ("idwaarneemgroep", "code") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "praktijkplanner_touch_version"()
RETURNS trigger AS $$
BEGIN
	NEW."updated_at" = now();
	NEW."version" = OLD."version" + 1;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "planning_touch_version_trigger"
BEFORE UPDATE ON "planning"
FOR EACH ROW EXECUTE FUNCTION "praktijkplanner_touch_version"();--> statement-breakpoint
CREATE TRIGGER "planningafwezigheden_touch_version_trigger"
BEFORE UPDATE ON "planningafwezigheden"
FOR EACH ROW EXECUTE FUNCTION "praktijkplanner_touch_version"();