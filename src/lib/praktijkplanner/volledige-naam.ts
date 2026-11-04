/**
 * De volledige namen van een activiteit en van een taak, voor de hoverkaart.
 *
 * Op het fiche in het rooster staat de afkorting, want daar is maar een paar tekens plek. In
 * de hoverkaart is diezelfde afkorting juist het probleem. OK Trans en OK Onco schelen twee
 * letters, en bij de taken komt een afkorting zelfs meer dan een keer voor: Spoed is zowel
 * Spoedsein Utrecht als Spoedsein Nieuwegein, en Cons, ILD en TBC staan er elk twee keer in.
 * Uit de afkorting alleen is dus niet op te maken wat er staat, en dat is precies wat een
 * planner die het rooster nog niet uit zijn hoofd kent nodig heeft.
 */

/** Naam van de activiteit, met de specificatie erachter als die er is. */
export function volledigeActiviteitNaam(
  activiteit: { naam: string; afkorting: string | null } | null,
  specificatie: { naam: string; afkorting: string | null } | null
): string | null {
  if (!activiteit) return null;
  const delen = [
    activiteit.naam || activiteit.afkorting,
    specificatie ? specificatie.naam || specificatie.afkorting : null,
  ].filter(Boolean);
  return delen.length > 0 ? delen.join(' · ') : null;
}

/**
 * Omschrijving van de taak, met de afkorting als terugval.
 *
 * Het nummer is de laatste terugval en niet de eerste keuze: een taak zonder omschrijving en
 * zonder afkorting bestaat, en een lege regel in de kaart zou de planner laten denken dat er
 * niets gepland staat.
 */
export function volledigeTaakNaam(taak: {
  id: number;
  afkorting: string | null;
  omschrijving: string | null;
}): string {
  return taak.omschrijving || taak.afkorting || `Taak ${taak.id}`;
}
