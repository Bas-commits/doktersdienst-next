-- De week waarvan herhaald wordt was nergens vastgelegd. Een herhaling kende alleen een
-- start, een eind en een frequentie, dus in "Herhalingen beheren" en bij het gele bordje
-- op een afwijkend dagdeel kon niet worden verteld waar de planning vandaan kwam.
--
-- Bestaande rijen blijven leeg. De bronweek is achteraf niet af te leiden: de week voor de
-- startdatum is een gok die misgaat zodra iemand een gat heeft gelaten tussen de bronweek
-- en de eerste doelweek, en dan staat er een verkeerde week bij het bordje. Geen week is
-- beter dan een verkeerde week.
ALTER TABLE "planningherhalingen" ADD COLUMN "bronstartdatum" date;
