-- Een dienstvoorkeur kent nu twee toestanden: aangevraagd door de arts, of vastgelegd door de
-- planner. Tot nu toe was er maar een, waardoor een wens van de arts er in het rooster net zo
-- uitzag als een afspraak die de planner al had gemaakt.
--
-- Dat is dezelfde tweedeling als bij een afwezigheid (planningafwezigheden.is_voorlopig), en
-- bewust dezelfde naam, zodat niemand hoeft te raden of het hetzelfde betekent. Het blijft een
-- rij per dagdeel: vastleggen verandert de toestand, het maakt er geen tweede rij bij.
--
-- Anders dan bij een afwezigheid staat de standaard hier op waar. Een rij zonder waarde is een
-- rij waarvan niemand weet wie hem heeft vastgelegd, en hem dan tonen als afspraak van de
-- planner is erger dan hem tonen als openstaande wens.
ALTER TABLE "praktijkplannerdienstvoorkeuren"
  ADD COLUMN IF NOT EXISTS "is_voorlopig" boolean DEFAULT true NOT NULL;
