ALTER TABLE "gesprekken" ADD COLUMN "was_bridged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "gesprekken" ADD COLUMN "talkDurationSec" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "gesprekken" ADD COLUMN "dialstatus" varchar(50);