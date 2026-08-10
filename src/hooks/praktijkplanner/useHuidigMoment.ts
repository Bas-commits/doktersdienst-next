import { useEffect, useState } from 'react';
import { huidigMoment } from '@/lib/praktijkplanner/huidig-dagdeel';

export type HuidigMoment = { datum: string; volgorde: number };

/**
 * De dag en het dagdeel die nu aan de beurt zijn, of null zolang dat nog niet vaststaat.
 *
 * Null bij de eerste render is met opzet: de server kent de klok van de browser niet, dus
 * meteen een datum invullen zou een andere pagina opleveren dan React daarna in de browser
 * bouwt. Een dagdeel later groen zien is beter dan een hydration-fout.
 *
 * De klok loopt door terwijl een scherm openstaat. Een planner die om kwart voor twaalf
 * begint zou anders de hele middag naar een groene ochtend zitten kijken, dus wordt er
 * elke minuut opnieuw gekeken.
 */
export function useHuidigMoment(): HuidigMoment | null {
  const [moment, setMoment] = useState<HuidigMoment | null>(null);

  useEffect(() => {
    const bijwerken = () =>
      setMoment((vorige) => {
        const nu = huidigMoment(new Date());
        if (vorige && vorige.datum === nu.datum && vorige.volgorde === nu.volgorde) {
          return vorige;
        }
        return nu;
      });

    bijwerken();
    const timer = window.setInterval(bijwerken, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return moment;
}
