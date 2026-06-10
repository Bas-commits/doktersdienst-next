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

/** Prefer `name`, otherwise voornaam + tussenvoegsel + achternaam (legacy deelnemers rows). */
export function formatDeelnemerDisplayName(row: DeelnemerNameFields): string | null {
  const fromName = row.name?.trim();
  if (fromName) return fromName;

  const parts = [row.voornaam, row.voorletterstussenvoegsel, row.achternaam]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' ') : null;
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
