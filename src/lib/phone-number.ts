const PHONE_CHARS_REGEX = /^[0-9+\s().-]+$/;
const E164_BODY_REGEX = /^[1-9]\d{7,14}$/;
const NL_NORMALIZED_REGEX = /^31\d{8,13}$/;

function sanitizePhoneInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!PHONE_CHARS_REGEX.test(trimmed)) return null;

  const compact = trimmed.replace(/[^0-9+]/g, '');
  const plusPosition = compact.indexOf('+');
  if (plusPosition > 0) return null;

  if (compact.startsWith('+')) {
    const e164Body = compact.slice(1);
    return E164_BODY_REGEX.test(e164Body) ? e164Body : null;
  }

  if (compact.startsWith('00')) {
    const intl = compact.slice(2);
    return E164_BODY_REGEX.test(intl) ? intl : null;
  }

  if (compact.startsWith('0')) {
    const nlIntl = `31${compact.slice(1)}`;
    return E164_BODY_REGEX.test(nlIntl) ? nlIntl : null;
  }

  return E164_BODY_REGEX.test(compact) ? compact : null;
}

/**
 * Normalize user-entered phone values to a digits-only international value.
 * For Dutch national numbers (starting with 0), this yields a `31...` string.
 */
export function normalizeDutchPhoneToIntl(value: string): string | null {
  const normalized = sanitizePhoneInput(value);
  if (!normalized) return null;
  return NL_NORMALIZED_REGEX.test(normalized) ? normalized : null;
}

export function isValidDutchPhone(value: string): boolean {
  return normalizeDutchPhoneToIntl(value) !== null;
}
