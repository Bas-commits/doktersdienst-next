/**
 * Het opnieuw voorstellen van een afgewezen overname.
 *
 * De knop met het rondje stond in twee schermen en deed in beide niets. Hij gaf het voorstel
 * door als `iddienstovern`, het nummer van de oorspronkelijke dienst, en sloeg over zodra dat
 * nul was. In deze database hebben alle 21 overnamerijen een lege `id` en negen van die 21
 * ook een `iddienstovern` van 0; die rijen komen uit de oude PHP-toepassing. Nul was dus geen
 * uitzondering maar de helft van de gevallen, en de gebruiker zag er niets van gebeuren.
 *
 * Een voorstel wordt daarom aangeduid met de gegevens die het altijd heeft: waarneemgroep,
 * begin, eind en de twee deelnemers. Dat is dezelfde sleutel die de server al gebruikt in
 * buildLegacyOvernameRowConditions, zodat scherm en server hetzelfde voorstel bedoelen.
 */
export type OvernameVerwijzing = {
  /** Nummer van de oorspronkelijke dienst. 0 als de rij er geen heeft. */
  iddienstovern: number;
  /** Nummer van de overnamerij zelf. Ontbreekt in deze database, maar niet per se in elke. */
  overnameId?: number;
  idwaarneemgroep: number;
  /** Begin en eind van het voorstel, in unixseconden. */
  van: number;
  tot: number;
  /** De arts van wie de dienst is, en de arts aan wie hij is aangeboden. */
  iddeelnemer?: number;
  iddeelnovern?: number;
};

/** Voldoende om de rij terug te vinden, ook zonder nummers. */
export function isVolledigeVerwijzing(verwijzing: OvernameVerwijzing): boolean {
  return (
    verwijzing.idwaarneemgroep > 0 && verwijzing.van > 0 && verwijzing.tot > verwijzing.van
  );
}

const VELDEN = {
  iddienstovern: 'recreate',
  overnameId: 'recreateProposal',
  idwaarneemgroep: 'recreateGroep',
  van: 'recreateVan',
  tot: 'recreateTot',
  iddeelnemer: 'recreateVanArts',
  iddeelnovern: 'recreateNaarArts',
} as const;

/**
 * De verwijzing als queryreeks, want de knop bovenin het scherm staat op een andere pagina en
 * navigeert ernaartoe. In de adresbalk en niet in het geheugen: dan overleeft de opdracht het
 * laden van de pagina die erop volgt.
 */
export function overnameVerwijzingNaarQuery(verwijzing: OvernameVerwijzing): string {
  const query = new URLSearchParams();
  for (const [sleutel, naam] of Object.entries(VELDEN)) {
    const waarde = verwijzing[sleutel as keyof OvernameVerwijzing];
    if (typeof waarde === 'number' && Number.isFinite(waarde)) {
      query.set(naam, String(waarde));
    }
  }
  return query.toString();
}

function getal(waarde: string | string[] | undefined): number {
  const enkel = Array.isArray(waarde) ? waarde[0] : waarde;
  const nummer = enkel == null || enkel === '' ? NaN : Number(enkel);
  return Number.isFinite(nummer) ? nummer : 0;
}

/**
 * Leest de verwijzing terug uit de query. Geeft null als er niets genoeg overblijft om een
 * voorstel mee aan te wijzen, zodat de pagina niet aan een halve opdracht begint.
 */
export function overnameVerwijzingUitQuery(
  query: Record<string, string | string[] | undefined>,
): OvernameVerwijzing | null {
  const verwijzing: OvernameVerwijzing = {
    iddienstovern: getal(query[VELDEN.iddienstovern]),
    idwaarneemgroep: getal(query[VELDEN.idwaarneemgroep]),
    van: getal(query[VELDEN.van]),
    tot: getal(query[VELDEN.tot]),
  };
  const overnameId = getal(query[VELDEN.overnameId]);
  if (overnameId > 0) verwijzing.overnameId = overnameId;
  const iddeelnemer = getal(query[VELDEN.iddeelnemer]);
  if (iddeelnemer > 0) verwijzing.iddeelnemer = iddeelnemer;
  const iddeelnovern = getal(query[VELDEN.iddeelnovern]);
  if (iddeelnovern > 0) verwijzing.iddeelnovern = iddeelnovern;

  return isVolledigeVerwijzing(verwijzing) ? verwijzing : null;
}

/**
 * Een sleutel om dezelfde opdracht niet twee keer uit te voeren. Het nummer van de dienst kan
 * daar niet voor dienen, want nul komt vaker voor dan eens.
 */
export function overnameVerwijzingSleutel(verwijzing: OvernameVerwijzing): string {
  return [
    verwijzing.idwaarneemgroep,
    verwijzing.van,
    verwijzing.tot,
    verwijzing.iddeelnemer ?? 0,
    verwijzing.iddeelnovern ?? 0,
  ].join(':');
}
