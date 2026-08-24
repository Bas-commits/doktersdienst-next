/**
 * De maten die een dagvakje in het maandoverzicht kan hebben, in pixels.
 *
 * Een vakje is vierkant, want er staat een fiche in met drie banden onder elkaar. 34 is de
 * kleinste maat waarop die banden nog uit elkaar te houden zijn en tegelijk de enige waarop
 * een maand van 31 dagen in zijn geheel op een gewoon scherm past. Dat was tot nu toe de
 * vaste maat. 56 is de maat van de weekweergave, en dus de eerste waarop de fiche precies zo
 * getekend kan worden als daar, met tekst en al. 72 is er voor wie de maand toch al zijwaarts
 * doorschuift en liever leest dan telt.
 */
export const MAAND_CEL_MATEN = [34, 44, 56, 72] as const;

export const MAAND_CEL_STANDAARD = MAAND_CEL_MATEN[0];

/**
 * Vanaf welke maat de fiche zijn tekst laat zien.
 *
 * Dit hangt aan de maat van het vakje en niet aan het knopje. Een fiche die zelf uitrekent of
 * er tekst in past kan niet in een stand komen waarin de tekst er half uit valt, ook niet als
 * er later een maat bij komt of een scherm zijn eigen maat kiest. 56 is niet willekeurig: dat
 * is de maat waarop de weekweergave de tekst al kwijt kan.
 */
export const MAAND_TEKST_VANAF_PX = 56;

/** Of een vakje van deze maat de fiche met tekst toont, zoals in de week. */
export function toontTekstInMaand(celGrootte: number): boolean {
  return celGrootte >= MAAND_TEKST_VANAF_PX;
}

/**
 * De volgende maat in of uit, of dezelfde als je aan het eind van de rij bent.
 *
 * Teruggeven wat er al stond in plaats van omlopen: een plus die na de grootste stand weer op
 * de kleinste uitkomt lijkt op een fout, en de knop staat toch uit op dat moment.
 */
export function volgendeCelGrootte(huidig: number, richting: 'in' | 'uit'): number {
  const index = MAAND_CEL_MATEN.indexOf(huidig as (typeof MAAND_CEL_MATEN)[number]);
  if (index === -1) return MAAND_CEL_STANDAARD;
  const volgende = richting === 'in' ? index + 1 : index - 1;
  return MAAND_CEL_MATEN[volgende] ?? huidig;
}
