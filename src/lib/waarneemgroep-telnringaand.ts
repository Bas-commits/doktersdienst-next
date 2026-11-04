import { normalizeDutchPhoneToIntl } from '@/lib/phone-number';

/** Telefoonnummer: 08800264XX of 318800264XX (laatste twee cijfers variabel) */
export const TELNR_RINGAAND_REGEX = /^(08800264[0-9]{2}|318800264[0-9]{2})$/;

/**
 * Canonical form for duplicate checks: digits-only international value (31…).
 * Accepts common stored/display formats such as 0887732752, 31887732752,
 * 0031887732752 and 088 - 7732752.
 */
export function normalizeTelnrOnzeCentraleKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  return normalizeDutchPhoneToIntl(value);
}

/**
 * @deprecated Use {@link normalizeTelnrOnzeCentraleKey} for duplicate checks.
 */
export function normalizeTelnrRingaandKey(value: string): string | null {
  return normalizeTelnrOnzeCentraleKey(value);
}

export function takenTelnrRingaandKeys(telnrs: (string | null | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const raw of telnrs) {
    const k = normalizeTelnrOnzeCentraleKey(raw);
    if (k) keys.add(k);
  }
  return keys;
}

export function isTelnrOnzeCentraleTaken(
  candidate: string,
  existingNumbers: (string | null | undefined)[]
): boolean {
  const candidateKey = normalizeTelnrOnzeCentraleKey(candidate);
  if (!candidateKey) return false;
  return takenTelnrRingaandKeys(existingNumbers).has(candidateKey);
}

/** First `count` free numbers in 08800… form (00–99), skipping keys already taken. */
export function suggestAvailableRingaandNummers(
  takenKeys: Set<string>,
  count: number
): string[] {
  const out: string[] = [];
  for (let i = 0; i < 100 && out.length < count; i++) {
    const national = `08800264${String(i).padStart(2, '0')}`;
    const key = normalizeTelnrOnzeCentraleKey(national);
    if (key && !takenKeys.has(key)) out.push(national);
  }
  return out;
}
