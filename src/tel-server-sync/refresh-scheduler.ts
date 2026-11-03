import { TZDate } from '@date-fns/tz';
import { APP_TIME_ZONE } from '@/lib/amsterdamWallTime';
import { logger } from '@/lib/logger';
import { loadTelGenerationConfig } from './config';
import { generateTelRecords, type GeneratedTelRecord } from './generate-telrecords';

const log = logger.child({ module: 'tel-sync/refresh-scheduler' });

const DEBOUNCE_MS = 2000;

type GenerateFn = () => Promise<GeneratedTelRecord[]>;

let dirty = false;
let inFlight: Promise<void> | null = null;
let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let runId = 0;
let lastResult: GeneratedTelRecord[] = [];
let generateFn: GenerateFn = defaultGenerate;

async function defaultGenerate(): Promise<GeneratedTelRecord[]> {
  return generateTelRecords({ config: loadTelGenerationConfig() });
}

function clearDebounce(): void {
  if (debounceHandle !== null) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
}

/**
 * Amsterdam calendar day bounds for `nowMs`: [startOfToday, startOfTomorrow) as Unix seconds.
 */
export function amsterdamDayBoundsUnix(nowMs: number = Date.now()): { dayStart: number; dayEnd: number } {
  const now = new TZDate(nowMs, APP_TIME_ZONE);
  const startToday = new TZDate(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, APP_TIME_ZONE);
  const startTomorrow = new TZDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    APP_TIME_ZONE,
  );
  return {
    dayStart: Math.floor(startToday.getTime() / 1000),
    dayEnd: Math.floor(startTomorrow.getTime() / 1000),
  };
}

/** True when [van, tot) overlaps today's calendar day in Europe/Amsterdam. */
export function overlapsAmsterdamToday(van: number, tot: number, nowMs: number = Date.now()): boolean {
  if (!Number.isFinite(van) || !Number.isFinite(tot)) return false;
  const { dayStart, dayEnd } = amsterdamDayBoundsUnix(nowMs);
  return van < dayEnd && tot > dayStart;
}

/** Assign middle (dienst) or top (achterwacht) for a shift overlapping today. */
export function shouldRefreshAfterAssign(
  section: string,
  van: number,
  tot: number,
  nowMs: number = Date.now(),
): boolean {
  if (section !== 'middle' && section !== 'top') return false;
  return overlapsAmsterdamToday(van, tot, nowMs);
}

/**
 * Accept of a non-bottom overname, or delete of an already-accepted non-bottom overname,
 * when the interval overlaps today.
 */
export function shouldRefreshAfterOvernameRespond(opts: {
  action: string;
  /** Row status before the write (e.g. pending / accepted). */
  status: string | null | undefined;
  overnameSectie: string | null | undefined;
  van: number;
  tot: number;
  nowMs?: number;
}): boolean {
  const sectie = (opts.overnameSectie ?? '').trim().toLowerCase();
  if (sectie === 'bottom') return false;

  const nowMs = opts.nowMs ?? Date.now();
  if (!overlapsAmsterdamToday(opts.van, opts.tot, nowMs)) return false;

  if (opts.action === 'accept') return true;
  if (opts.action === 'delete' && (opts.status ?? '').trim().toLowerCase() === 'accepted') {
    return true;
  }
  return false;
}

async function pump(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    while (dirty) {
      dirty = false;
      clearDebounce();
      runId += 1;
      try {
        lastResult = await generateFn();
        log.info({ count: lastResult.length, runId }, 'PBX telrecords refresh completed');
      } catch (err) {
        log.error({ err, runId }, 'PBX telrecords refresh failed');
        throw err;
      }
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Fire-and-forget: debounce 2s when idle; if a run is already in flight, only mark dirty
 * so one follow-up runs immediately after (no second debounce).
 */
export function scheduleTelRecordRefresh(): void {
  dirty = true;
  if (inFlight) return;

  clearDebounce();
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    void pump().catch(() => {
      /* logged in pump */
    });
  }, DEBOUNCE_MS);
}

/**
 * Cancel debounce, ensure a fresh run, and wait until a generation that started after this
 * call has finished (including any immediate follow-up while dirty).
 */
export async function runTelRecordRefreshNow(): Promise<GeneratedTelRecord[]> {
  clearDebounce();
  dirty = true;
  const needRunAfter = runId;
  await pump();
  if (runId <= needRunAfter) {
    // pump returned without running (should not happen when dirty was set); force once more
    dirty = true;
    await pump();
  }
  return lastResult;
}

/** Test helpers — reset module state between cases. */
export function __resetTelRefreshSchedulerForTests(options?: { generate?: GenerateFn }): void {
  clearDebounce();
  dirty = false;
  inFlight = null;
  runId = 0;
  lastResult = [];
  generateFn = options?.generate ?? defaultGenerate;
}
