-- Copying a week reuses planningherhalingen because planningherhalingslots.idherhaling is
-- NOT NULL and part of the primary key, so a copied slot has nowhere to attach without a
-- parent row. Those rows then showed up in "Herhalingen beheren" as a weekly repetition
-- running from one day to the same day.
--
-- Existing rows are deliberately left at false. A copy and a genuine one-week series are
-- stored identically (startdatum = einddatum, frequentie 1) and the repeat modal permits
-- that shape, so there is no rule that separates them after the fact. Flagging by shape
-- would hide real series from the planner, which is worse than leaving old copies visible.
ALTER TABLE "planningherhalingen" ADD COLUMN "is_kopie" boolean DEFAULT false NOT NULL;
