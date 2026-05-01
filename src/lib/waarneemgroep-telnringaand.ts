/** Telefoonnummer: 08800264XX of 318800264XX (laatste twee cijfers variabel) */
export const TELNR_RINGAAND_REGEX = /^(08800264[0-9]{2}|318800264[0-9]{2})$/;

/**
 * Canonical form for duplicate checks: always 318800264XX (international-style as used in this app).
 */
export function normalizeTelnrRingaandKey(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (t.startsWith('08800264') && t.length === 10) {
    return `31${t.slice(1)}`;
  }
  if (t.startsWith('318800264') && t.length === 11) {
    return t;
  }
  return null;
}

export function takenTelnrRingaandKeys(telnrs: (string | null | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const raw of telnrs) {
    if (raw == null) continue;
    const k = normalizeTelnrRingaandKey(raw);
    if (k) keys.add(k);
  }
  return keys;
}

/** First `count` free numbers in 08800… form (00–99), skipping keys already taken. */
export function suggestAvailableRingaandNummers(
  takenKeys: Set<string>,
  count: number
): string[] {
  const out: string[] = [];
  for (let i = 0; i < 100 && out.length < count; i++) {
    const national = `08800264${String(i).padStart(2, '0')}`;
    const key = normalizeTelnrRingaandKey(national);
    if (key && !takenKeys.has(key)) out.push(national);
  }
  return out;
}
