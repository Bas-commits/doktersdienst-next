import { describe, expect, it } from 'vitest';
import { absenceDisplayBackground, absenceDisplayColor } from './absence-icons';

describe('absence display colors', () => {
  it('uses legacy palette colors for known absence codes', () => {
    expect(absenceDisplayBackground('vakantie', '#334155', false)).toContain('#cd1745');
    expect(absenceDisplayBackground('fte', '#22c55e', false)).toContain('#d0bb48');
    expect(absenceDisplayColor('vakantie', '#334155', false)).toBe('#cd1745');
    expect(absenceDisplayColor('fte', '#22c55e', false)).toBe('#d0bb48');
  });

  it('falls back to configured kleur for custom absence types', () => {
    expect(absenceDisplayBackground('custom', '#123456', false)).toBe('#123456');
    expect(absenceDisplayColor('custom', '#123456', false)).toBe('#123456');
  });
});
