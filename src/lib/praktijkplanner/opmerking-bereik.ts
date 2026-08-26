/**
 * Hoever een opmerking bij een fiche doorwerkt in de herhaling waar die fiche bij hoort.
 *
 * Een herhaling herhaalt een hele week, dus "voor de herhaling" is geen enkele vraag maar
 * twee: welke fiches van die week, en vanaf wanneer. Zonder die splitsing landt een opmerking
 * over de dinsdagochtend ook op de vrijdagnacht van elke week in de reeks.
 */
export type OpmerkingBereik = 'fiche' | 'dagdeel' | 'dag' | 'reeks';

/** Een fiche uit de reeks, zoals hij uit planningherhalingslots plus planning komt. */
export type OpmerkingReeksFiche = {
  idplanning: number;
  datum: string;
  iddagdeel: number;
};

/** De keuzes in de volgorde waarin ze in het venster staan, met hun tekst. */
export const OPMERKING_BEREIKEN: readonly { waarde: OpmerkingBereik; label: string }[] = [
  { waarde: 'fiche', label: 'Alleen deze fiche' },
  { waarde: 'dagdeel', label: 'Dit dagdeel, elke herhaling' },
  { waarde: 'dag', label: 'Deze hele dag, elke herhaling' },
  { waarde: 'reeks', label: 'Alle fiches van deze herhaling' },
];

export function isOpmerkingBereik(waarde: unknown): waarde is OpmerkingBereik {
  return OPMERKING_BEREIKEN.some((keuze) => keuze.waarde === waarde);
}

/*
  Middag om de datum heen zodat een zomertijdsprong de dag niet een etmaal verschuift, en UTC
  zodat de weekdag niet van de tijdzone van de server afhangt.
*/
function weekdag(datum: string): number {
  return new Date(`${datum}T12:00:00Z`).getUTCDay();
}

/**
 * Welke planningsregels de opmerking krijgen.
 *
 * De reeks staat als losse planningsregels in de database, dus er is geen plek waar de tekst
 * een keer kan staan. Dit kiest de regels waar hij op gezet wordt.
 *
 * Fiches die later bij de reeks komen krijgen niets mee: de opmerking hangt aan de regels die
 * er op dit moment zijn, niet aan de reeksdefinitie.
 */
export function kiesOpmerkingDoelen(opties: {
  bereik: OpmerkingBereik;
  bron: OpmerkingReeksFiche;
  reeks: readonly OpmerkingReeksFiche[];
  ookEerdereWeken: boolean;
}): number[] {
  const { bereik, bron, reeks, ookEerdereWeken } = opties;
  if (bereik === 'fiche' || reeks.length === 0) return [bron.idplanning];

  const bronWeekdag = weekdag(bron.datum);
  const gekozen = new Set<number>([bron.idplanning]);
  for (const fiche of reeks) {
    // Datums zijn ISO, dus een tekstvergelijking is hier hetzelfde als een datumvergelijking.
    if (!ookEerdereWeken && fiche.datum < bron.datum) continue;
    if (bereik !== 'reeks' && weekdag(fiche.datum) !== bronWeekdag) continue;
    if (bereik === 'dagdeel' && fiche.iddagdeel !== bron.iddagdeel) continue;
    gekozen.add(fiche.idplanning);
  }
  return [...gekozen].sort((a, b) => a - b);
}
