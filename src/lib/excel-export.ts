/**
 * Het maken en downloaden van Excel-bestanden, gedeeld door alle schermen die een exportknop
 * hebben.
 *
 * De vorm ligt vast: elk bestand heeft een tabblad Gegevens met een regel per feit, en daarnaast
 * de samenvattingen die het scherm zelf toont. Wie wil rekenen gebruikt het eerste tabblad, wie
 * wil kijken de rest, en omdat ze uit dezelfde regels komen kunnen ze niet uit elkaar lopen.
 *
 * Waarom niet CSV: de Nederlandse komma als decimaalteken vecht met de puntkomma als
 * scheidingsteken, en een achternaam met een komma erin doet de rest.
 */

/** Wat er in een cel mag. Een Date wordt een echte datumcel, een number een getalcel. */
export type ExcelWaarde = string | number | Date | null;

export type ExcelBlad = {
  naam: string;
  rijen: ExcelWaarde[][];
  /** Kolombreedtes in tekens. Korter dan het aantal kolommen mag; de rest krijgt de standaard. */
  kolombreedtes?: number[];
  /**
   * Kolommen (nulgebaseerd) die alleen de dag tonen, ook als het bestand verder tijden bevat.
   *
   * Bestaat voor een blad met zowel een dagkolom als een begin- en eindtijd. Zonder dit kreeg de
   * dagkolom er 00:00 achter, en dat leest als een gegeven terwijl het er geen is.
   */
  dagKolommen?: number[];
};

/**
 * Notatie voor datumcellen. Excel toont dit, maar de cel bevat een echte datum, dus sorteren,
 * filteren op maand en een draaitabel werken gewoon. Eerder ging de datum als tekst het bestand
 * in: dat ziet er hetzelfde uit en kan geen van drieen.
 */
const DATUM_NOTATIE = 'dd-mm-yyyy hh:mm';

/** Notatie voor een datum zonder tijd, waar het dagdeel de tijd al zegt. */
export const DAG_NOTATIE = 'dd-mm-yyyy';

/** Excel weigert deze tekens in een bladnaam, en kapt de naam af na 31 tekens. */
const VERBODEN_IN_BLADNAAM = /[[\]:*?/\\]/g;
const MAX_BLADNAAM = 31;

/** Codepunten van de combinerende accenttekens, die NFD los achter een letter zet. */
const ACCENT_START = 0x0300;
const ACCENT_EIND = 0x036f;

/**
 * Geeft elke datumcel in het blad zijn notatie.
 *
 * Loopt over de cellen in plaats van over een lijst kolomnummers: welke kolom een datum is
 * verschilt per blad, en een lijst die niet meeschuift met een kolom erbij levert een bestand
 * op waarin de datums als een getal van vijf cijfers verschijnen.
 */
function zetDatumNotatie(blad: Record<string, unknown>, notatie: string): void {
  for (const [adres, cel] of Object.entries(blad)) {
    if (adres.startsWith('!')) continue;
    const getypeerd = cel as { t?: string; z?: string };
    if (getypeerd.t === 'd') getypeerd.z = notatie;
  }
}

/**
 * Geeft de aangewezen kolommen de dagnotatie, na de algemene notatie van het bestand.
 *
 * Loopt hier wel over kolomnummers, anders dan `zetDatumNotatie`: welke kolom een dag zonder tijd
 * is kan de cel zelf niet zeggen, want het is dezelfde datum als de begintijd ernaast.
 */
function zetDagNotatie(
  XLSX: typeof import('xlsx'),
  blad: Record<string, unknown>,
  kolommen: number[],
  aantalRijen: number
): void {
  for (const kolom of kolommen) {
    for (let rij = 0; rij < aantalRijen; rij++) {
      const cel = blad[XLSX.utils.encode_cell({ r: rij, c: kolom })] as
        | { t?: string; z?: string }
        | undefined;
      if (cel?.t === 'd') cel.z = DAG_NOTATIE;
    }
  }
}

/** Maakt een bladnaam die Excel accepteert. */
export function bladnaam(naam: string): string {
  return naam.replace(VERBODEN_IN_BLADNAAM, ' ').slice(0, MAX_BLADNAAM) || 'Blad';
}

/**
 * Maakt van een naam een stuk bestandsnaam dat elk besturingssysteem accepteert.
 *
 * "Velde, Carine, C van der" wordt "velde-carine-c-van-der". Wat hier weg moet is meer dan de
 * verboden tekens van het bestandssysteem: een komma en een spatie leveren een bestandsnaam op
 * die in een mail of een chatvenster halverwege afbreekt.
 *
 * De accenten gaan er los af in plaats van dat de letter zelf sneuvelt. Zonder die stap wordt
 * een e met een accent geen "e" maar een streepje, en heet het bestand van Jose "jos-".
 */
export function naamVoorBestandsnaam(naam: string): string {
  const zonderAccenten = Array.from(naam.normalize('NFD'))
    .filter((teken) => {
      const code = teken.codePointAt(0) ?? 0;
      return code < ACCENT_START || code > ACCENT_EIND;
    })
    .join('');

  return (
    zonderAccenten
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export'
  );
}

/**
 * Bouwt het werkboek en zet de download in gang.
 *
 * `xlsx` wordt hier pas ingeladen en niet boven in het bestand. De bibliotheek is fors, en een
 * scherm dat je opent zonder ooit te downloaden hoeft hem niet mee te krijgen.
 *
 * @param datumNotatie Notatie voor elke datumcel in het bestand. Standaard met tijd erbij; geef
 *   `DAG_NOTATIE` mee als het dagdeel de tijd al zegt en 00:00 achter elke datum onzin is.
 */
export async function downloadWerkboek(
  bestandsnaam: string,
  bladen: ExcelBlad[],
  datumNotatie: string = DATUM_NOTATIE
): Promise<void> {
  const XLSX = await import('xlsx');
  const werkboek = XLSX.utils.book_new();

  for (const blad of bladen) {
    const sheet = XLSX.utils.aoa_to_sheet(blad.rijen, { cellDates: true });
    if (blad.kolombreedtes) {
      sheet['!cols'] = blad.kolombreedtes.map((wch) => ({ wch }));
    }
    zetDatumNotatie(sheet, datumNotatie);
    if (blad.dagKolommen?.length) {
      zetDagNotatie(XLSX, sheet, blad.dagKolommen, blad.rijen.length);
    }
    XLSX.utils.book_append_sheet(werkboek, sheet, bladnaam(blad.naam));
  }

  XLSX.writeFile(werkboek, bestandsnaam, { cellDates: true });
}
