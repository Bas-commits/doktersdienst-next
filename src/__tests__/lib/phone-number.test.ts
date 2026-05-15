import { describe, expect, it } from 'vitest';
import { isValidDutchPhone, normalizeDutchPhoneToIntl } from '@/lib/phone-number';

describe('normalizeDutchPhoneToIntl', () => {
  it('normalizes Dutch national numbers to 31-prefixed form', () => {
    expect(normalizeDutchPhoneToIntl('0887732752')).toBe('31887732752');
    expect(normalizeDutchPhoneToIntl('06 12 34 56 78')).toBe('31612345678');
  });

  it('accepts already international values with separators', () => {
    expect(normalizeDutchPhoneToIntl('+31 88 773 27 52')).toBe('31887732752');
    expect(normalizeDutchPhoneToIntl('0031(88)773-2752')).toBe('31887732752');
  });

  it('rejects invalid values', () => {
    expect(normalizeDutchPhoneToIntl('12')).toBeNull();
    expect(normalizeDutchPhoneToIntl('abc')).toBeNull();
    expect(normalizeDutchPhoneToIntl('+3188abc2752')).toBeNull();
  });
});

describe('isValidDutchPhone', () => {
  it('returns true for valid Dutch phone formats', () => {
    expect(isValidDutchPhone('0887732752')).toBe(true);
    expect(isValidDutchPhone('+31887732752')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidDutchPhone('')).toBe(false);
    expect(isValidDutchPhone('123')).toBe(false);
  });
});
