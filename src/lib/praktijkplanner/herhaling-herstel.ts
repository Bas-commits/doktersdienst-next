import { addDays, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

/**
 * Welke dag uit de bronweek hoort bij een fiche van een herhaling.
 *
 * Een herhaling herhaalt een hele week, dus een fiche op donderdag hoort bij de donderdag van
 * de bronweek. Nergens wordt bewaard wat er stond voordat een planner er iets overheen plakte,
 * dus de bronweek is de enige beschrijving van wat de herhaling voorschrijft. Wie de bronweek
 * later aanpast, verandert daarmee ook wat er bij herstellen terugkomt.
 *
 * Beide weken beginnen op maandag: de reeks zet weken neer vanaf een maandag en
 * `bronstartdatum` is de maandag van de week die de planner heeft laten herhalen.
 */
export function bronDatumVoorFiche(bronstartdatum: string, datum: string): string {
  const dagenInDeWeek = Math.round(
    (new Date(`${datum}T12:00:00Z`).getTime() -
      new Date(`${startOfIsoWeek(datum)}T12:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  return addDays(bronstartdatum, dagenInDeWeek);
}
