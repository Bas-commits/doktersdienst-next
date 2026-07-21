import type {
  PraktijkplannerParticipantSchedulableDaypart,
  PraktijkplannerSchedulableDaypart,
} from '@/types/praktijkplanner';

/** ISO weekday: Monday=1 … Sunday=7. */
export function isoWeekdayFromDate(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00`).getDay() || 7;
}

export function schedulableCellKey(weekdag: number, iddagdeel: number): string {
  return `${weekdag}:${iddagdeel}`;
}

/**
 * Empty matrix ⇒ all combinations schedulable (backward compatible).
 * Otherwise a cell is schedulable only when an active row exists for that weekday × daypart.
 */
export function isDaypartSchedulable(
  matrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  weekdagOrDate: number | string,
  iddagdeel: number
): boolean {
  if (matrix.length === 0) return true;

  const weekdag =
    typeof weekdagOrDate === 'string' ? isoWeekdayFromDate(weekdagOrDate) : weekdagOrDate;

  const byKey = new Map(
    matrix.map((row) => [schedulableCellKey(row.weekdag, row.iddagdeel), row.actief])
  );
  return byKey.get(schedulableCellKey(weekdag, iddagdeel)) === true;
}

/**
 * Group matrix first, then optional per-deelnemer override.
 * Empty participant matrix ⇒ inherit group availability.
 */
export function isDaypartSchedulableForParticipant(
  groupMatrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  participantMatrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  weekdagOrDate: number | string,
  iddagdeel: number
): boolean {
  if (!isDaypartSchedulable(groupMatrix, weekdagOrDate, iddagdeel)) return false;
  if (participantMatrix.length === 0) return true;
  return isDaypartSchedulable(participantMatrix, weekdagOrDate, iddagdeel);
}

export function participantMatrixFor(
  all: ReadonlyArray<PraktijkplannerParticipantSchedulableDaypart>,
  iddeelnemer: number
): PraktijkplannerSchedulableDaypart[] {
  return all
    .filter((row) => row.iddeelnemer === iddeelnemer)
    .map(({ weekdag, iddagdeel, actief }) => ({ weekdag, iddagdeel, actief }));
}

/** Synthesize a full active matrix when none is stored (editor default). */
export function defaultAllSchedulable(
  daypartIds: ReadonlyArray<number>
): PraktijkplannerSchedulableDaypart[] {
  const cells: PraktijkplannerSchedulableDaypart[] = [];
  for (let weekdag = 1; weekdag <= 7; weekdag += 1) {
    for (const iddagdeel of daypartIds) {
      cells.push({ weekdag, iddagdeel, actief: true });
    }
  }
  return cells;
}

export function resolveSchedulableMatrixForEditor(
  stored: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  daypartIds: ReadonlyArray<number>
): PraktijkplannerSchedulableDaypart[] {
  if (stored.length === 0) return defaultAllSchedulable(daypartIds);

  const byKey = new Map(
    stored.map((row) => [schedulableCellKey(row.weekdag, row.iddagdeel), row.actief])
  );
  const cells: PraktijkplannerSchedulableDaypart[] = [];
  for (let weekdag = 1; weekdag <= 7; weekdag += 1) {
    for (const iddagdeel of daypartIds) {
      cells.push({
        weekdag,
        iddagdeel,
        actief: byKey.get(schedulableCellKey(weekdag, iddagdeel)) === true,
      });
    }
  }
  return cells;
}

/**
 * Editor default for a deelnemer: inherit group actief flags.
 * When participant rows exist, use those (group-disabled cells stay off).
 */
export function resolveParticipantMatrixForEditor(
  groupMatrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  participantStored: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  daypartIds: ReadonlyArray<number>
): PraktijkplannerSchedulableDaypart[] {
  const groupResolved = resolveSchedulableMatrixForEditor(groupMatrix, daypartIds);
  if (participantStored.length === 0) {
    return groupResolved.map((cell) => ({ ...cell }));
  }
  const byKey = new Map(
    participantStored.map((row) => [schedulableCellKey(row.weekdag, row.iddagdeel), row.actief])
  );
  return groupResolved.map((cell) => ({
    weekdag: cell.weekdag,
    iddagdeel: cell.iddagdeel,
    actief:
      cell.actief && byKey.get(schedulableCellKey(cell.weekdag, cell.iddagdeel)) === true,
  }));
}
