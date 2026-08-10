/**
 * Woorden bij de absentie op een dagdeel.
 *
 * Staat apart zodat de fiche in het rooster en de hoverkaart hetzelfde zeggen. Het
 * vraagteken alleen vertelt niet wat er is aangevraagd en ook niet dat het nog moet worden
 * goedgekeurd, en dat is precies wat de planner wil weten voordat hij het dagdeel vult.
 *
 * @param type Naam van het absentietype, bijvoorbeeld Nascholing. Null als die ontbreekt.
 * @param aangevraagd Waar zolang de absentie voorlopig is, dus nog niet goedgekeurd.
 */
export function absentieTekst(type: string | null, aangevraagd: boolean): string {
  if (aangevraagd) {
    return type
      ? `Absentie aangevraagd: ${type}. Nog niet goedgekeurd.`
      : 'Absentie aangevraagd. Nog niet goedgekeurd.';
  }
  return type ? `Absentie: ${type}. Goedgekeurd.` : 'Absentie. Goedgekeurd.';
}
