import { describe, it, expect } from 'vitest';
import { hasShiftEnded } from '@/lib/shift-window';

describe('hasShiftEnded', () => {
  const nowMs = Date.UTC(2026, 7, 5, 12, 0, 0);
  const nowSeconds = nowMs / 1000;

  it('is true for a shift that ended yesterday', () => {
    expect(hasShiftEnded(nowSeconds - 24 * 60 * 60, nowMs)).toBe(true);
  });

  it('is false for a shift that ends tomorrow', () => {
    expect(hasShiftEnded(nowSeconds + 24 * 60 * 60, nowMs)).toBe(false);
  });

  it('is false while a shift is still running', () => {
    // The rule is the end moment, not the start: a shift that began this morning
    // and runs until tonight can still take preferences.
    expect(hasShiftEnded(nowSeconds + 60, nowMs)).toBe(false);
  });

  it('is true the moment the shift ends', () => {
    expect(hasShiftEnded(nowSeconds, nowMs)).toBe(true);
  });

  it('defaults to the current clock', () => {
    expect(hasShiftEnded(Math.floor(Date.now() / 1000) - 60)).toBe(true);
    expect(hasShiftEnded(Math.floor(Date.now() / 1000) + 3600)).toBe(false);
  });
});
