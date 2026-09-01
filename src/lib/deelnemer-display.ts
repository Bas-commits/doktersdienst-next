export type DeelnemerNameFields = {
  name?: string | null;
  voornaam?: string | null;
  voorletterstussenvoegsel?: string | null;
  achternaam?: string | null;
  initialen?: string | null;
};

export type DeelnemerChipInitialsOptions = {
  /** Max length when deriving initials from name parts (default 2). */
  maxFallbackLength?: number;
  /** Shown when no initialen or name fields are available (default '?'). */
  fallback?: string;
};

/**
 * Voornaam + tussenvoegsel + achternaam, en pas als die alle drie leeg zijn de kolom `name`.
 *
 * De losse velden zijn wat de deelnemer zelf invult in Mijn gegevens. De kolom `name` wordt
 * alleen gevuld bij het aanmaken van een deelnemer en daarna nooit meer bijgewerkt, dus zodra
 * iemand zijn naam wijzigt loopt die kolom achter. Bij de oudste rijen staat er niet eens een
 * hele naam in, alleen de voornaam. Kreeg `name` voorrang, dan toonde de kop van het scherm een
 * andere naam dan het scherm eronder. `name` blijft staan als terugval voor rijen zonder losse
 * velden.
 */
export function formatDeelnemerDisplayName(row: DeelnemerNameFields): string | null {
  const parts = [row.voornaam, row.voorletterstussenvoegsel, row.achternaam]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) return parts.join(' ');

  return row.name?.trim() || null;
}

/**
 * De naam waarmee we iemand aanspreken op zijn eigen schermen: alleen de voornaam.
 *
 * Bewust niet de hele naam. Het veld `voorletterstussenvoegsel` bevat allebei die dingen door
 * elkaar, en er is geen manier om ze uit elkaar te halen: `V D` kan "van der" zijn of de
 * voorletters van Victor Daniel, en in dat veld staat niets waarmee je dat onderscheidt. Een
 * hele naam samenstellen levert dus of "Bart B Veltenaar", of bij het weglaten van dat veld
 * "Jacob Beek" in plaats van "Jacob van Beek". Kort en juist is beter dan volledig en soms
 * fout, zeker op een scherm waar je je eigen naam leest en de initialen er al naast staan.
 *
 * Voor de naam van een *ander* is dit niet genoeg: daar moet je naamgenoten kunnen scheiden.
 * Zie deelnemerRoosterNaam en de opbouw in de overname-popover.
 */
export function deelnemerRoepnaam(row: DeelnemerNameFields): string | null {
  return row.voornaam?.trim() || row.achternaam?.trim() || row.initialen?.trim() || null;
}

/**
 * De naam zoals de roosterschermen hem tonen: achternaam eerst, dan voornaam.
 *
 * Dezelfde volgorde als in de lijst deelnemers, en anders dan formatDeelnemerDisplayName. Op een
 * scherm met een rij per dokter wil je op achternaam kunnen aflezen, en in een Excel-bestand op
 * achternaam kunnen sorteren.
 */
export function deelnemerRoosterNaam(
  fields: DeelnemerNameFields & { id?: number }
): string {
  return (
    [fields.achternaam, fields.voornaam, fields.voorletterstussenvoegsel]
      .filter(Boolean)
      .join(', ') ||
    fields.name ||
    fields.initialen ||
    `Deelnemer ${fields.id ?? ''}`.trim()
  );
}

/** Prefer `initialen` from mijn-gegevens; otherwise derive from name parts. */
export function deelnemerChipInitials(
  fields: DeelnemerNameFields,
  options?: DeelnemerChipInitialsOptions
): string {
  const fromInitialen = fields.initialen?.trim();
  if (fromInitialen) return fromInitialen;

  const max = options?.maxFallbackLength ?? 2;
  const fallback = options?.fallback ?? '?';

  const fromNames = [fields.voornaam, fields.achternaam]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().charAt(0).toUpperCase())
    .join('');
  if (fromNames) {
    return fromNames.slice(0, max);
  }

  const display = formatDeelnemerDisplayName(fields);
  if (display) {
    return display
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, max);
  }

  return fallback;
}

export function deelnemerInitialsFromFields(row: DeelnemerNameFields): string {
  return deelnemerChipInitials(row);
}

export function deelnemerInitialsFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
