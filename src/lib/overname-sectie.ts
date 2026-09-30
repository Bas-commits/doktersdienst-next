/**
 * Which lane of a dienst an overname is about. Stored in `diensten.overname_sectie`.
 *
 * `null` is the middle lane, the ordinary dienst. That is what every overname was before
 * achterwacht and extra dokter could be taken over, so old rows (and clients that never send a
 * section, like the mobile app) keep meaning exactly what they meant.
 */
export type OvernameSectie = 'top' | 'bottom';

/** Assignment `type` of the lane being taken over: 0 dienst, 5 achterwacht, 11 extra dokter. */
export function assignmentTypeForSectie(sectie: OvernameSectie | null): 0 | 5 | 11 {
  if (sectie === 'top') return 5;
  if (sectie === 'bottom') return 11;
  return 0;
}

export function overnameSectieLabel(sectie: OvernameSectie | null | undefined): string {
  if (sectie === 'top') return 'Achterwacht';
  if (sectie === 'bottom') return 'Extra dokter';
  return 'Dienst';
}

/**
 * Parses a request value. `undefined` (key absent) and `null`/`''`/`'middle'` all mean the middle
 * lane; anything else that is not 'top' or 'bottom' is rejected so a typo cannot silently turn an
 * achterwacht overname into a dienst overname.
 *
 * Returns `{ ok: false }` for an unknown value.
 */
export function parseOvernameSectie(
  raw: unknown,
): { ok: true; sectie: OvernameSectie | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === '' || raw === 'middle') {
    return { ok: true, sectie: null };
  }
  if (raw === 'top' || raw === 'bottom') return { ok: true, sectie: raw };
  return { ok: false };
}

/** Normalises what the database returns (varchar, possibly padded or odd-cased) to a section. */
export function toOvernameSectie(value: string | null | undefined): OvernameSectie | null {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'top' || v === 'bottom' ? v : null;
}
