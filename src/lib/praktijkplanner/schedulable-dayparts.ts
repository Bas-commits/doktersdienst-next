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

/**
 * De weekdagen die het rooster helemaal weglaat.
 *
 * Een groep die in Plannerbeheer aangeeft nooit op zaterdag te werken, hoeft die kolom niet te
 * zien; hij stond er tot nu toe grijs bij, zonder dat er iets in te zetten was. Een lege matrix
 * betekent "alles mag" en laat dus niets weg.
 *
 * Wat de groep uit heeft staan wint, ook als er toch iets op die dag staat. Dat was eerst
 * andersom: een gevulde dag bleef staan zodat het werk bereikbaar bleef. De eigenaar heeft dat
 * op 12 augustus 2026 omgedraaid, omdat er in de praktijk oude planning op zulke dagen ligt en
 * de kolom daardoor toch elke week terugkwam. De prijs: die planning is via het scherm niet
 * meer te zien of weg te halen, en staat wel gewoon in de database.
 */
export function weekdagenZonderRooster(
  matrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>
): Set<number> {
  const weg = new Set<number>();
  if (matrix.length === 0) return weg;
  const gebruikt = new Set(matrix.filter((row) => row.actief).map((row) => row.weekdag));
  for (let weekdag = 1; weekdag <= 7; weekdag += 1) {
    if (!gebruikt.has(weekdag)) weg.add(weekdag);
  }
  return weg;
}

/**
 * De dagdelen die het rooster helemaal weglaat, om dezelfde reden als bij de weekdagen: op geen
 * enkele weekdag in gebruik.
 *
 * Avond en nacht kunnen hier ook uit komen. Dat is iets anders dan de knop avond en nacht: die
 * gaat over wat je nu wilt zien, dit over wat de groep nooit doet.
 */
export function dagdelenZonderRooster(
  matrix: ReadonlyArray<PraktijkplannerSchedulableDaypart>,
  daypartIds: ReadonlyArray<number>
): Set<number> {
  const weg = new Set<number>();
  if (matrix.length === 0) return weg;
  const gebruikt = new Set(matrix.filter((row) => row.actief).map((row) => row.iddagdeel));
  for (const iddagdeel of daypartIds) {
    if (!gebruikt.has(iddagdeel)) weg.add(iddagdeel);
  }
  return weg;
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
