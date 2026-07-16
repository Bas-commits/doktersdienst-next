ALTER TABLE "planningherhalingslots"
	ADD COLUMN "is_uitzondering" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "planningherhalingslots"
	ADD COLUMN "uitzondering_at" timestamp;
--> statement-breakpoint
CREATE TABLE "planningherhalinguitzonderingen" (
	"id" serial PRIMARY KEY NOT NULL,
	"idherhaling" integer NOT NULL,
	"reeksdatum" date NOT NULL,
	"iddagdeel" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planningherhalinguitzonderingen"
	ADD CONSTRAINT "planningherhalinguitzonderingen_idherhaling_planningherhalingen_id_fk"
	FOREIGN KEY ("idherhaling") REFERENCES "public"."planningherhalingen"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planningherhalinguitzonderingen"
	ADD CONSTRAINT "planningherhalinguitzonderingen_iddagdeel_dagdelen_id_fk"
	FOREIGN KEY ("iddagdeel") REFERENCES "public"."dagdelen"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planningherhalinguitzonderingen"
	ADD CONSTRAINT "planningherhalinguitzonderingen_created_by_deelnemers_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."deelnemers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planningherhalinguitzonderingen"
	ADD CONSTRAINT "planningherhalinguitzonderingen_series_date_daypart_unique"
	UNIQUE("idherhaling","reeksdatum","iddagdeel");
