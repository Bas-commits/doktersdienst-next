import { describe, expect, it } from 'vitest';
import { absenceDisplayBackground, absenceDisplayColor, absencePaletteIconPath } from './absence-icons';

describe('absence palette icons', () => {
  it('uses foreground help icons without baked-in backgrounds for provisional palette items', () => {
    expect(absencePaletteIconPath('compensatie', 'compensation.svg', true)).toBe('/icons/afwezigheidstypen-iconen/compensation-help.svg');
    expect(absencePaletteIconPath('vakantie', 'holliday.svg', true)).toBe('/icons/afwezigheidstypen-iconen/holliday-help.svg');
  });
});

describe('absence display colors', () => {
  it('uses configured kleur for known absence codes when set', () => {
    expect(absenceDisplayBackground('vakantie', '#334155', false)).toBe('#334155');
    expect(absenceDisplayBackground('fte', '#22c55e', false)).toBe('#22c55e');
    expect(absenceDisplayColor('vakantie', '#334155', false)).toBe('#334155');
    expect(absenceDisplayColor('fte', '#22c55e', false)).toBe('#22c55e');
  });

  it('brightens configured kleur for provisional absences', () => {
    expect(absenceDisplayBackground('compensatie', '#c24613', true)).toBe('#cd673d');
    expect(absenceDisplayColor('compensatie', '#c24613', true)).toBe('#cd673d');
  });

  it('falls back to legacy palette colors when kleur is missing', () => {
    expect(absenceDisplayBackground('vakantie', null, false)).toContain('#cd1745');
    expect(absenceDisplayBackground('compensatie', null, true)).toContain('#db5016');
    expect(absenceDisplayColor('fte', null, false)).toBe('#d0bb48');
  });

  it('falls back to configured kleur for custom absence types', () => {
    expect(absenceDisplayBackground('custom', '#123456', false)).toBe('#123456');
    expect(absenceDisplayColor('custom', '#123456', false)).toBe('#123456');
  });
});
