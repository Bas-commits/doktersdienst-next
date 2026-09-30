/**
 * Het nevenscherm in een eigen tabblad, voor een scherm dat te smal is om het naast het
 * hoofdscherm te zetten.
 *
 * Eerder bleef de splitsknop op een smal scherm uit te klikken. Het nevenscherm verving dan het
 * hoofdscherm, dus plannen en kijken tegelijk kon niet. Nu opent de knop hetzelfde scherm in een
 * tabblad dat alleen het nevenscherm toont; het hoofdtabblad houdt de week of het rooster. Een
 * tabblad kan op een tweede monitor, en de twee lopen gelijk via een BroadcastChannel.
 * Kaart: https://trello.com/c/FHVfCvMC
 */

/** Query-parameter die een pagina vertelt dat zij het losse nevenscherm is. */
export const LOS_PARAM = 'los';

/**
 * Het adres voor het losse tabblad: dezelfde pagina, met `los` en wat het tabblad nodig heeft om
 * op hetzelfde te openen als het hoofdtabblad.
 */
export function nevenschermTabbladUrl(pad: string, params: Record<string, string | number>): string {
  const zoek = new URLSearchParams({ [LOS_PARAM]: '1' });
  for (const [sleutel, waarde] of Object.entries(params)) zoek.set(sleutel, String(waarde));
  return `${pad}?${zoek.toString()}`;
}

/**
 * Leest de query van dit tabblad, of null als dit niet het losse nevenscherm is.
 *
 * Uit window.location en niet uit router.query: bij de Pages Router is die bij de eerste render
 * nog leeg, en de beginstand van het scherm wordt juist bij de eerste render bepaald.
 */
export function losTabbladParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null;
  const zoek = new URLSearchParams(window.location.search);
  return zoek.get(LOS_PARAM) === '1' ? zoek : null;
}

/**
 * Opent het tabblad, of haalt het bestaande naar voren. Een vaste naam per scherm zorgt dat een
 * tweede klik niet steeds een nieuw tabblad bijmaakt.
 *
 * Returns:
 *     Het tabblad, of null als de browser het tegenhield (een pop-upblokkering).
 */
export function openNevenschermTabblad(url: string, naam: string): Window | null {
  const tabblad = window.open(url, naam);
  tabblad?.focus();
  return tabblad;
}
