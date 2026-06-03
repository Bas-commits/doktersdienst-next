import { describe, expect, it } from 'vitest';
import {
  isTelnrOnzeCentraleTaken,
  normalizeTelnrOnzeCentraleKey,
  suggestAvailableRingaandNummers,
  takenTelnrRingaandKeys,
} from '@/lib/waarneemgroep-telnringaand';

describe('normalizeTelnrOnzeCentraleKey', () => {
  it('treats common display formats as the same number', () => {
    const formats = ['31887732752', '0031887732752', '0887732752', '088 - 7732752', '+31 88 773 27 52'];
    const keys = formats.map((value) => normalizeTelnrOnzeCentraleKey(value));
    expect(new Set(keys)).toEqual(new Set(['31887732752']));
  });

  it('normalizes ringaand numbers to international form', () => {
    expect(normalizeTelnrOnzeCentraleKey('0880026453')).toBe('31880026453');
    expect(normalizeTelnrOnzeCentraleKey('31880026453')).toBe('31880026453');
  });
});

describe('takenTelnrRingaandKeys', () => {
  it('detects duplicates across differently formatted stored values', () => {
    const taken = takenTelnrRingaandKeys(['088 - 7732752', '0031880026453', null]);
    expect(taken.has('31887732752')).toBe(true);
    expect(taken.has('31880026453')).toBe(true);
  });
});

describe('isTelnrOnzeCentraleTaken', () => {
  it('returns true when candidate matches an existing number in another format', () => {
    expect(isTelnrOnzeCentraleTaken('0880026453', ['0031880026453'])).toBe(true);
    expect(isTelnrOnzeCentraleTaken('0887732752', ['31887732752'])).toBe(true);
  });

  it('returns false when numbers differ', () => {
    expect(isTelnrOnzeCentraleTaken('0880026453', ['31887732752'])).toBe(false);
  });
});

describe('suggestAvailableRingaandNummers', () => {
  it('excludes numbers already taken in alternate formats', () => {
    const taken = takenTelnrRingaandKeys(['0031880026400']);
    const available = suggestAvailableRingaandNummers(taken, 100);
    expect(available).not.toContain('0880026400');
  });
});
