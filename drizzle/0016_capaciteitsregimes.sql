-- De Capaciteitsplanner kende per locatie precies een sjabloon: weekdag maal dagdeel, zonder
-- datum. Elke week van het jaar werd dus aan dezelfde lat gelegd, terwijl rond de zomer en de
-- kerst de bezetting nu eenmaal lager ligt. Die weken kleurden in het Capaciteitsoverzicht over
-- de hele linie rood zonder dat er iets mis was, en daar went een planner aan.
--
-- Een afwijkende week wordt een benoemd regime waar weken aan hangen. Een regime vervangt de
-- normale week en vult hem niet aan: wat in het regime staat is wat geldt. Bij aanvullen zou
-- een leeg veld twee dingen kunnen betekenen, niet ingevuld of niet nodig, en dan is een eis
-- nooit weg te halen. Juist weghalen is waar dit om begonnen was.
CREATE TABLE "capaciteitsregimes" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"naam" varchar(60) NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capaciteitsregimes"
	ADD CONSTRAINT "capaciteitsregimes_idwaarneemgroep_waarneemgroepen_id_fk"
	FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsregimes"
	ADD CONSTRAINT "capaciteitsregimes_updated_by_deelnemers_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsregimes"
	ADD CONSTRAINT "capaciteitsregimes_group_naam_unique" UNIQUE("idwaarneemgroep","naam");
--> statement-breakpoint
CREATE INDEX "capaciteitsregimes_group_idx" ON "capaciteitsregimes" USING btree ("idwaarneemgroep");
--> statement-breakpoint

-- Een week wordt vastgelegd als de maandag ervan, niet als jaar plus weeknummer. Een ISO-week
-- die over de jaargrens loopt hoort bij twee jaartallen en het weeknummer van de kerst
-- verschuift, dus rekenen met (jaar, week) gaat elk jaar een keer mis. Een datum niet.
--
-- De sleutel op (waarneemgroep, maandag) zorgt dat een week nooit aan twee regimes kan hangen.
-- Dat is een vraag die het overzicht per dag stelt, en het antwoord hoort er maar een te zijn;
-- de database bewaakt dat, niet de code die de vraag stelt.
CREATE TABLE "capaciteitsregimeweken" (
	"idwaarneemgroep" integer NOT NULL,
	"idregime" integer NOT NULL,
	"maandag" date NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capaciteitsregimeweken_group_maandag_pk" PRIMARY KEY("idwaarneemgroep","maandag")
);
--> statement-breakpoint
ALTER TABLE "capaciteitsregimeweken"
	ADD CONSTRAINT "capaciteitsregimeweken_idwaarneemgroep_waarneemgroepen_id_fk"
	FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsregimeweken"
	ADD CONSTRAINT "capaciteitsregimeweken_idregime_capaciteitsregimes_id_fk"
	FOREIGN KEY ("idregime") REFERENCES "public"."capaciteitsregimes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsregimeweken"
	ADD CONSTRAINT "capaciteitsregimeweken_updated_by_deelnemers_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsregimeweken"
	ADD CONSTRAINT "capaciteitsregimeweken_maandag_check" CHECK (EXTRACT(ISODOW FROM "maandag") = 1);
--> statement-breakpoint
CREATE INDEX "capaciteitsregimeweken_regime_idx" ON "capaciteitsregimeweken" USING btree ("idregime");
--> statement-breakpoint

-- Het sjabloon zonder regime is de normale week. Bestaande rijen houden NULL en blijven dus
-- gewoon gelden, precies zoals ze deden.
ALTER TABLE "capaciteitsjablonen" ADD COLUMN "idregime" integer;
--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen"
	ADD CONSTRAINT "capaciteitsjablonen_idregime_capaciteitsregimes_id_fk"
	FOREIGN KEY ("idregime") REFERENCES "public"."capaciteitsregimes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capaciteitsjablonen"
	DROP CONSTRAINT "capaciteitsjablonen_group_location_weekday_daypart_unique";
--> statement-breakpoint

-- NULLS NOT DISTINCT, anders telt Postgres twee normale weken als verschillend omdat hun
-- idregime NULL is, en dan staan er stilletjes twee maandagochtenden naast elkaar waarvan het
-- overzicht er willekeurig een pakt.
ALTER TABLE "capaciteitsjablonen"
	ADD CONSTRAINT "capaciteitsjablonen_group_location_weekday_daypart_regime_uq"
	UNIQUE NULLS NOT DISTINCT ("idwaarneemgroep","idplannerlocatie","weekdag","iddagdeel","idregime");
--> statement-breakpoint
CREATE INDEX "capaciteitsjablonen_regime_idx" ON "capaciteitsjablonen" USING btree ("idregime");
