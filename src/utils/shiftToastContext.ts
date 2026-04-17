import type { ShiftBlockView } from '@/types/diensten';

/** Time range and optional dienstaantekening for toast descriptions (voorkeuren, secretaris-rooster). */
export function shiftBlockToastDescription(block: ShiftBlockView): string {
  const time = `${block.startTime}–${block.endTime}`;
  const note = (block.aantekeningTekst ?? '').trim();
  return note ? `${time} · ${note}` : time;
}
