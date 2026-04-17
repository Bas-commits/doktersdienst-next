import { describe, it, expect } from 'vitest';
import { getContrastTextColor } from '../contrastTextColor';

describe('getContrastTextColor', () => {
  it('returns black on bright yellow', () => {
    expect(getContrastTextColor('#ffeb3b')).toBe('#000000');
    expect(getContrastTextColor('#FFFF00')).toBe('#000000');
  });

  it('returns white on dark blue', () => {
    expect(getContrastTextColor('#1e3a5f')).toBe('#ffffff');
    expect(getContrastTextColor('000080')).toBe('#ffffff');
  });

  it('uses luminance threshold: just above 0.5 uses black', () => {
    expect(getContrastTextColor('#c0c0c0')).toBe('#000000');
  });

  it('returns white for invalid or non-hex input', () => {
    expect(getContrastTextColor('transparent')).toBe('#ffffff');
    expect(getContrastTextColor('#gg0000')).toBe('#ffffff');
    expect(getContrastTextColor('#fff')).toBe('#ffffff');
  });
});
