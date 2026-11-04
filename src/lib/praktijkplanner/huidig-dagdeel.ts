import { formatIsoDate } from './dates';

/**
 * Volgorde van de dagdelen zoals ze in de tabel dagdelen staan: 1 Ochtend, 2 Middag,
 * 3 Avond, 4 Nacht.
 */
export const DAGDEEL_OCHTEND = 1;
export const DAGDEEL_MIDDAG = 2;
export const DAGDEEL_AVOND = 3;
export const DAGDEEL_NACHT = 4;

/**
 * Vanaf welk uur welk dagdeel loopt. De tabel dagdelen kent alleen een naam en een
 * volgorde, geen tijden, dus deze grenzen zijn hier gekozen en nergens anders vastgelegd.
 *
 * Middernacht begint een nieuwe dag. De uren tussen 00:00 en 07:00 horen dus bij de nacht
 * van de dag die dan begint, niet bij de nacht van gisteren. Dat is de afspraak met de
 * planners: anders licht om 02:00 op dinsdag het vakje van maandag op, en dan klopt het
 * groen niet meer met de datum die ernaast staat.
 */
const GRENZEN: ReadonlyArray<{ totUur: number; volgorde: number }> = [
  { totUur: 7, volgorde: DAGDEEL_NACHT },
  { totUur: 12, volgorde: DAGDEEL_OCHTEND },
  { totUur: 17, volgorde: DAGDEEL_MIDDAG },
  { totUur: 23, volgorde: DAGDEEL_AVOND },
  { totUur: 24, volgorde: DAGDEEL_NACHT },
];

/** De volgorde van het dagdeel waar dit tijdstip in valt. */
export function huidigeDagdeelVolgorde(now: Date): number {
  const uur = now.getHours();
  for (const grens of GRENZEN) {
    if (uur < grens.totUur) return grens.volgorde;
  }
  return DAGDEEL_NACHT;
}

/** De dag en het dagdeel die op dit moment aan de beurt zijn. */
export function huidigMoment(now: Date): { datum: string; volgorde: number } {
  return { datum: formatIsoDate(now), volgorde: huidigeDagdeelVolgorde(now) };
}
