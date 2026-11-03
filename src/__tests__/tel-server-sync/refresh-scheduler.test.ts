import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TZDate } from '@date-fns/tz';
import { APP_TIME_ZONE } from '@/lib/amsterdamWallTime';

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/tel-server-sync/config', () => ({
  loadTelGenerationConfig: () => ({ tijdVooruit: 604800 }),
}));

vi.mock('@/tel-server-sync/generate-telrecords', () => ({
  generateTelRecords: vi.fn(),
}));

import {
  __resetTelRefreshSchedulerForTests,
  overlapsAmsterdamToday,
  runTelRecordRefreshNow,
  scheduleTelRecordRefresh,
  shouldRefreshAfterAssign,
  shouldRefreshAfterOvernameRespond,
} from '@/tel-server-sync/refresh-scheduler';

function amsterdamUnix(y: number, m0: number, d: number, h = 0, min = 0, s = 0): number {
  return Math.floor(new TZDate(y, m0, d, h, min, s, APP_TIME_ZONE).getTime() / 1000);
}

describe('overlapsAmsterdamToday', () => {
  // Fixed "now": 2026-06-15 12:00 Europe/Amsterdam
  const noon = new TZDate(2026, 5, 15, 12, 0, 0, APP_TIME_ZONE).getTime();

  it('returns true when the interval overlaps today', () => {
    const van = amsterdamUnix(2026, 5, 15, 8);
    const tot = amsterdamUnix(2026, 5, 15, 18);
    expect(overlapsAmsterdamToday(van, tot, noon)).toBe(true);
  });

  it('returns true for an overnight shift that ends today', () => {
    const van = amsterdamUnix(2026, 5, 14, 22);
    const tot = amsterdamUnix(2026, 5, 15, 6);
    expect(overlapsAmsterdamToday(van, tot, noon)).toBe(true);
  });

  it('returns false for a future day', () => {
    const van = amsterdamUnix(2026, 5, 16, 8);
    const tot = amsterdamUnix(2026, 5, 16, 18);
    expect(overlapsAmsterdamToday(van, tot, noon)).toBe(false);
  });

  it('returns false for a past day', () => {
    const van = amsterdamUnix(2026, 5, 14, 8);
    const tot = amsterdamUnix(2026, 5, 14, 18);
    expect(overlapsAmsterdamToday(van, tot, noon)).toBe(false);
  });
});

describe('shouldRefreshAfterAssign', () => {
  const noon = new TZDate(2026, 5, 15, 12, 0, 0, APP_TIME_ZONE).getTime();
  const van = amsterdamUnix(2026, 5, 15, 8);
  const tot = amsterdamUnix(2026, 5, 15, 18);

  it('schedules for middle and top overlapping today', () => {
    expect(shouldRefreshAfterAssign('middle', van, tot, noon)).toBe(true);
    expect(shouldRefreshAfterAssign('top', van, tot, noon)).toBe(true);
  });

  it('skips bottom (extra dokter)', () => {
    expect(shouldRefreshAfterAssign('bottom', van, tot, noon)).toBe(false);
  });

  it('skips future middle assignments', () => {
    const futureVan = amsterdamUnix(2026, 5, 20, 8);
    const futureTot = amsterdamUnix(2026, 5, 20, 18);
    expect(shouldRefreshAfterAssign('middle', futureVan, futureTot, noon)).toBe(false);
  });
});

describe('shouldRefreshAfterOvernameRespond', () => {
  const noon = new TZDate(2026, 5, 15, 12, 0, 0, APP_TIME_ZONE).getTime();
  const van = amsterdamUnix(2026, 5, 15, 8);
  const tot = amsterdamUnix(2026, 5, 15, 18);

  it('schedules on accept for dienst and achterwacht', () => {
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'accept',
        status: 'pending',
        overnameSectie: null,
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(true);
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'accept',
        status: 'pending',
        overnameSectie: 'top',
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(true);
  });

  it('skips accept for extra dokter (bottom)', () => {
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'accept',
        status: 'pending',
        overnameSectie: 'bottom',
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(false);
  });

  it('schedules delete only when the row was accepted', () => {
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'delete',
        status: 'accepted',
        overnameSectie: null,
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(true);
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'delete',
        status: 'pending',
        overnameSectie: null,
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(false);
  });

  it('skips decline', () => {
    expect(
      shouldRefreshAfterOvernameRespond({
        action: 'decline',
        status: 'pending',
        overnameSectie: null,
        van,
        tot,
        nowMs: noon,
      }),
    ).toBe(false);
  });
});

describe('tel refresh scheduler coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    __resetTelRefreshSchedulerForTests();
    vi.useRealTimers();
  });

  it('debounces multiple schedule calls into one generate', async () => {
    const generate = vi.fn().mockResolvedValue([{ normalizedNr: '1' }]);
    __resetTelRefreshSchedulerForTests({ generate });

    scheduleTelRecordRefresh();
    scheduleTelRecordRefresh();
    scheduleTelRecordRefresh();
    expect(generate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1999);
    expect(generate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('runs a follow-up immediately when dirty during an in-flight generate', async () => {
    let resolveFirst!: (v: unknown[]) => void;
    const first = new Promise<unknown[]>((resolve) => {
      resolveFirst = resolve;
    });
    const generate = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce([{ normalizedNr: '2' }]);

    __resetTelRefreshSchedulerForTests({ generate });

    const nowPromise = runTelRecordRefreshNow();
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(1);

    scheduleTelRecordRefresh();
    resolveFirst([{ normalizedNr: '1' }]);

    const result = await nowPromise;
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ normalizedNr: '2' }]);
  });

  it('runTelRecordRefreshNow cancels debounce and runs immediately', async () => {
    const generate = vi.fn().mockResolvedValue([{ normalizedNr: '9' }]);
    __resetTelRefreshSchedulerForTests({ generate });

    scheduleTelRecordRefresh();
    expect(generate).not.toHaveBeenCalled();

    const result = await runTelRecordRefreshNow();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ normalizedNr: '9' }]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
