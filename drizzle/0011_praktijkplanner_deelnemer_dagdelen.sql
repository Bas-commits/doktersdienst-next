CREATE TABLE "praktijkplannerdeelnemerdagdelen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idwaarneemgroep" integer NOT NULL,
	"iddeelnemer" integer NOT NULL,
	"weekdag" smallint NOT NULL,
	"iddagdeel" integer NOT NULL,
	"actief" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_idwaarneemgroep_waarneemgroepen_id_fk"
	FOREIGN KEY ("idwaarneemgroep") REFERENCES "public"."waarneemgroepen"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_iddeelnemer_deelnemers_id_fk"
	FOREIGN KEY ("iddeelnemer") REFERENCES "public"."deelnemers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_iddagdeel_dagdelen_id_fk"
	FOREIGN KEY ("iddagdeel") REFERENCES "public"."dagdelen"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_updated_by_deelnemers_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_unique"
	UNIQUE("idwaarneemgroep","iddeelnemer","weekdag","iddagdeel");
--> statement-breakpoint
ALTER TABLE "praktijkplannerdeelnemerdagdelen"
	ADD CONSTRAINT "praktijkplannerdeelnemerdagdelen_weekdag_check"
	CHECK ("weekdag" >= 1 AND "weekdag" <= 7);
--> statement-breakpoint
CREATE INDEX "praktijkplannerdeelnemerdagdelen_group_participant_idx"
	ON "praktijkplannerdeelnemerdagdelen" USING btree ("idwaarneemgroep","iddeelnemer");
