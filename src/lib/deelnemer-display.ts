export type DeelnemerNameFields = {
  name?: string | null;
  voornaam?: string | null;
  voorletterstussenvoegsel?: string | null;
  achternaam?: string | null;
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

export function deelnemerInitialsFromFields(row: DeelnemerNameFields): string {
  const display = formatDeelnemerDisplayName(row);
  if (display) {
    return display
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return '?';
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
