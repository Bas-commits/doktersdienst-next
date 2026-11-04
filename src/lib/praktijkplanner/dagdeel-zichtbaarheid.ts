import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';

/**
 * Tot en met welke volgorde een dagdeel overdag valt: Ochtend en Middag.
 *
 * Avond en Nacht zijn de twee die weg mogen. De twee schermen waren het hierover oneens: de
 * Activiteiten planner rekende Avond bij de dag (`volgorde >= 4 ? nacht : dag`) en de
 * Afwezigheidsplanner bij de nacht. Ze delen wel dezelfde opgeslagen voorkeur, dus één vinkje
 * betekende op het ene scherm iets anders dan op het andere.
 */
export const LAATSTE_DAGDEEL_OVERDAG = 2;

/** Of dit dagdeel Avond of Nacht is, en dus verborgen mag worden. */
export function isAvondOfNacht(daypart: { volgorde: number }): boolean {
  return daypart.volgorde > LAATSTE_DAGDEEL_OVERDAG;
}

/**
 * De dagdelen die het rooster laat zien.
 *
 * Overdag staat er altijd. Avond en Nacht staan er alleen als de knop aan staat, en dat is de
 * hele regel: het is een kwestie van beeld, niet van inhoud. Er wordt niets opgeslagen of
 * weggegooid, en wat verborgen is komt met dezelfde knop weer terug.
 *
 * Eerder hielden avond en nacht zichzelf zichtbaar zodra er iets in gepland stond, zodat werk
 * nooit onzichtbaar kon worden. Dat maakte de knop onvoorspelbaar: in de ene week deed hij
 * niets en in de andere wel, terwijl juist de drukke weken de reden zijn om ochtend en middag
 * meer ruimte te geven. De eigenaar heeft dat op 12 augustus 2026 omgedraaid. De prijs staat
 * er tegenover: zolang je ze verborgen hebt zie je niet dat er een avonddienst onder zit.
 */
export function zichtbareDagdelen(
  dayparts: ReadonlyArray<PraktijkplannerDaypart>,
  opties: { toonAvondNacht: boolean }
): PraktijkplannerDaypart[] {
  return dayparts.filter((daypart) => !isAvondOfNacht(daypart) || opties.toonAvondNacht);
}
