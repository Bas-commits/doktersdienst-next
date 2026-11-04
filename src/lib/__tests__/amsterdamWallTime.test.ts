import { describe, expect, it } from 'vitest';
import { parseAmsterdamWallDateTimeToUnixSeconds } from '@/lib/amsterdamWallTime';

describe('parseAmsterdamWallDateTimeToUnixSeconds', () => {
  it('parses summer (CEST) wall time', () => {
    // 2024-07-15 08:00 Amsterdam → 2024-07-15T06:00:00.000Z
    expect(parseAmsterdamWallDateTimeToUnixSeconds('2024-07-15 08:00:00')).toBe(1721023200);
  });

  it('parses winter (CET) wall time', () => {
    // 2024-01-15 08:00 Amsterdam → 2024-01-15T07:00:00.000Z
    expect(parseAmsterdamWallDateTimeToUnixSeconds('2024-01-15 08:00:00')).toBe(1705302000);
  });

  it('returns null on bad input', () => {
    expect(parseAmsterdamWallDateTimeToUnixSeconds('')).toBeNull();
    expect(parseAmsterdamWallDateTimeToUnixSeconds('gibberish')).toBeNull();
    expect(parseAmsterdamWallDateTimeToUnixSeconds('2024-01-01')).toBeNull();
  });
});
