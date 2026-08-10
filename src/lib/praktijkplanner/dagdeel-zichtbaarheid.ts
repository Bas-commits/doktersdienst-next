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

type Slot = { iddeelnemer: number; datum: string; iddagdeel: number };

/**
 * Of er in de zichtbare periode iets in Avond of Nacht staat dat de rijen nodig maakt.
 *
 * Kijkt naar de slots die geladen zijn, dus precies de week of de maand die in beeld is. Een
 * deelnemer die uit het filter valt telt niet mee: die rij staat er niet, dus zijn avond hoeft
 * geen ruimte te kosten.
 *
 * Planning telt altijd. Een absentie alleen als diezelfde deelnemer op die dag niet ook
 * overdag afwezig is. Een week vakantie wordt namelijk op alle vier de dagdelen gezet, en
 * daarmee zou vrijwel elke week "gevuld" zijn en zouden de rijen nooit verdwijnen. Wie de
 * hele dag weg is, is dat 's avonds ook; dat staat al in de ochtendrij. Een absentie die
 * alléén op de avond staat is wel echt nieuws en houdt de rijen dus open.
 */
export function heeftAvondOfNachtInhoud(
  planning: ReadonlyArray<Slot>,
  absenties: ReadonlyArray<Slot>,
  dayparts: ReadonlyArray<PraktijkplannerDaypart>,
  zichtbareDeelnemers: ReadonlySet<number>
): boolean {
  const avondNacht = new Set(dayparts.filter(isAvondOfNacht).map((daypart) => daypart.id));
  const telt = (slot: Slot) =>
    avondNacht.has(slot.iddagdeel) && zichtbareDeelnemers.has(slot.iddeelnemer);

  if (planning.some(telt)) return true;

  const overdagAfwezig = new Set(
    absenties
      .filter((slot) => !avondNacht.has(slot.iddagdeel))
      .map((slot) => `${slot.iddeelnemer}:${slot.datum}`)
  );
  return absenties.some(
    (slot) => telt(slot) && !overdagAfwezig.has(`${slot.iddeelnemer}:${slot.datum}`)
  );
}

/**
 * De dagdelen die het rooster laat zien.
 *
 * Overdag staat er altijd. Avond en Nacht verdwijnen alleen als ze in de hele zichtbare
 * periode leeg zijn: die twee rijen zijn bijna de helft van de hoogte van een deelnemersrij en
 * bij de meeste weken staat er niets in.
 *
 * `toonAvondNacht` zet ze terug in beeld. Dat is niet alleen gemak, het is wat het verbergen
 * veilig maakt: is Avond leeg en dus verborgen, dan valt er ook nooit meer een eerste avond in
 * te plannen. Andersom kan de knop niets verbergen wat wél gepland staat, want dan zou werk
 * onzichtbaar worden.
 */
export function zichtbareDagdelen(
  dayparts: ReadonlyArray<PraktijkplannerDaypart>,
  opties: { heeftInhoud: boolean; toonAvondNacht: boolean }
): PraktijkplannerDaypart[] {
  const toon = opties.heeftInhoud || opties.toonAvondNacht;
  return dayparts.filter((daypart) => !isAvondOfNacht(daypart) || toon);
}
