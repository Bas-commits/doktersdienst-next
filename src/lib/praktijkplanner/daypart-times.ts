import type { PraktijkplannerDaypart, PraktijkplannerDaypartTime } from '@/types/praktijkplanner';

/**
 * Een tijd zoals de invoervelden en de opslag hem allebei begrijpen: HH:MM.
 *
 * Postgres geeft een time terug als 08:00:00 en een <input type="time"> levert 08:00. Zonder
 * die seconden eraf te halen zou het scherm elke keer denken dat er iets gewijzigd is.
 * Alles wat er niet uitziet als een tijd wordt leeg, want half ingevulde tijden slaan we niet op.
 */
export function normaliseerTijd(waarde: unknown): string {
  if (typeof waarde !== 'string') return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(waarde.trim());
  if (!match) return '';
  const uur = Number(match[1]);
  const minuut = Number(match[2]);
  if (uur > 23 || minuut > 59) return '';
  return `${String(uur).padStart(2, '0')}:${String(minuut).padStart(2, '0')}`;
}

/**
 * De tijden per dagdeel, ook voor de dagdelen die er nog geen hebben.
 *
 * De editor wil voor elk dagdeel een regel, ook een lege. Daarom staat hier een lege string
 * waar de database geen rij heeft, en niet null: dat is precies wat een leeg invoerveld is.
 */
export function tijdenPerDagdeel(
  dayparts: ReadonlyArray<PraktijkplannerDaypart>,
  tijden: ReadonlyArray<PraktijkplannerDaypartTime>
): Array<{ iddagdeel: number; begintijd: string; eindtijd: string }> {
  const opgeslagen = new Map(tijden.map((rij) => [rij.iddagdeel, rij]));
  return [...dayparts]
    .sort((a, b) => a.volgorde - b.volgorde)
    .map((daypart) => {
      const rij = opgeslagen.get(daypart.id);
      return {
        iddagdeel: daypart.id,
        begintijd: normaliseerTijd(rij?.begintijd),
        eindtijd: normaliseerTijd(rij?.eindtijd),
      };
    });
}

/**
 * Alleen de regels die helemaal ingevuld zijn gaan naar de server.
 *
 * Een dagdeel met alleen een begintijd zegt niets over wanneer het afgelopen is, dus daar is
 * geen tijd van te maken. Zo'n regel wordt overgeslagen, en het dagdeel houdt geen tijd.
 */
export function volledigIngevuldeTijden(
  regels: ReadonlyArray<{ iddagdeel: number; begintijd: string; eindtijd: string }>
): PraktijkplannerDaypartTime[] {
  return regels
    .map((regel) => ({
      iddagdeel: regel.iddagdeel,
      begintijd: normaliseerTijd(regel.begintijd),
      eindtijd: normaliseerTijd(regel.eindtijd),
    }))
    .filter((regel) => regel.begintijd !== '' && regel.eindtijd !== '');
}

/**
 * Een regel waarvan er een van de twee tijden is ingevuld: dat is een halve invoer.
 *
 * Weigeren doen we niet, want dan kun je een tijd niet meer weghalen zonder allebei de velden
 * leeg te maken in de goede volgorde. Het scherm zegt wel wat er gebeurt.
 */
export function halfIngevuldeDagdelen(
  regels: ReadonlyArray<{ iddagdeel: number; begintijd: string; eindtijd: string }>
): number[] {
  return regels
    .filter((regel) => {
      const begin = normaliseerTijd(regel.begintijd) !== '';
      const eind = normaliseerTijd(regel.eindtijd) !== '';
      return begin !== eind;
    })
    .map((regel) => regel.iddagdeel);
}

/**
 * Dezelfde labels, maar in een kaart om in op te zoeken.
 *
 * Een rooster tekent honderden vakjes en vraagt bij elk vakje naar het dagdeel. De lijst
 * doorzoeken per vakje is werk dat een keer per keer tekenen gedaan kan worden.
 */
export function tijdLabels(
  tijden: ReadonlyArray<PraktijkplannerDaypartTime>
): Map<number, string> {
  const kaart = new Map<number, string>();
  for (const rij of tijden) {
    const label = tijdLabel([rij], rij.iddagdeel);
    if (label) kaart.set(rij.iddagdeel, label);
  }
  return kaart;
}

/**
 * Wat er achter de naam van een dagdeel komt te staan, bijvoorbeeld 08:00 - 13:00.
 *
 * Leeg als de groep geen tijden heeft ingevuld, zodat de aanroeper niets hoeft te weten van
 * wel of niet gevulde rijen.
 */
export function tijdLabel(
  tijden: ReadonlyArray<PraktijkplannerDaypartTime>,
  iddagdeel: number
): string {
  const rij = tijden.find((item) => item.iddagdeel === iddagdeel);
  if (!rij) return '';
  const begin = normaliseerTijd(rij.begintijd);
  const eind = normaliseerTijd(rij.eindtijd);
  if (!begin || !eind) return '';
  return `${begin} - ${eind}`;
}
