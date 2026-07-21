import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  isDaypartSchedulable,
  isDaypartSchedulableForParticipant,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type {
  PraktijkplannerParticipantSchedulableDaypart,
  PraktijkplannerSchedulableDaypart,
} from '@/types/praktijkplanner';

export class SchedulableDaypartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulableDaypartError';
  }
}

export async function loadSchedulableDayparts(
  idwaarneemgroep: number
): Promise<PraktijkplannerSchedulableDaypart[]> {
  const rows = await db
    .select({
      weekdag: schema.praktijkplannerdagdelen.weekdag,
      iddagdeel: schema.praktijkplannerdagdelen.iddagdeel,
      actief: schema.praktijkplannerdagdelen.actief,
    })
    .from(schema.praktijkplannerdagdelen)
    .where(eq(schema.praktijkplannerdagdelen.idwaarneemgroep, idwaarneemgroep));

  return rows
    .filter(
      (row): row is typeof row & { weekdag: number; iddagdeel: number; actief: boolean } =>
        row.weekdag != null && row.iddagdeel != null && row.actief != null
    )
    .map((row) => ({
      weekdag: row.weekdag,
      iddagdeel: row.iddagdeel,
      actief: row.actief,
    }));
}

export async function loadParticipantSchedulableDayparts(
  idwaarneemgroep: number,
  iddeelnemer?: number
): Promise<PraktijkplannerParticipantSchedulableDaypart[]> {
  const rows = await db
    .select({
      iddeelnemer: schema.praktijkplannerdeelnemerdagdelen.iddeelnemer,
      weekdag: schema.praktijkplannerdeelnemerdagdelen.weekdag,
      iddagdeel: schema.praktijkplannerdeelnemerdagdelen.iddagdeel,
      actief: schema.praktijkplannerdeelnemerdagdelen.actief,
    })
    .from(schema.praktijkplannerdeelnemerdagdelen)
    .where(
      iddeelnemer == null
        ? eq(schema.praktijkplannerdeelnemerdagdelen.idwaarneemgroep, idwaarneemgroep)
        : and(
            eq(schema.praktijkplannerdeelnemerdagdelen.idwaarneemgroep, idwaarneemgroep),
            eq(schema.praktijkplannerdeelnemerdagdelen.iddeelnemer, iddeelnemer)
          )
    );

  return rows
    .filter(
      (
        row
      ): row is typeof row & {
        iddeelnemer: number;
        weekdag: number;
        iddagdeel: number;
        actief: boolean;
      } =>
        row.iddeelnemer != null &&
        row.weekdag != null &&
        row.iddagdeel != null &&
        row.actief != null
    )
    .map((row) => ({
      iddeelnemer: row.iddeelnemer,
      weekdag: row.weekdag,
      iddagdeel: row.iddagdeel,
      actief: row.actief,
    }));
}

export async function assertDaypartSchedulable(
  idwaarneemgroep: number,
  datum: string,
  iddagdeel: number,
  iddeelnemer?: number
): Promise<void> {
  const groupMatrix = await loadSchedulableDayparts(idwaarneemgroep);
  if (iddeelnemer == null) {
    if (!isDaypartSchedulable(groupMatrix, datum, iddagdeel)) {
      throw new SchedulableDaypartError('Dit dagdeel is niet inplanbaar voor deze dag.');
    }
    return;
  }

  const participantRows = await loadParticipantSchedulableDayparts(idwaarneemgroep, iddeelnemer);
  const participantMatrix = participantRows.map(({ weekdag, iddagdeel: id, actief }) => ({
    weekdag,
    iddagdeel: id,
    actief,
  }));
  if (!isDaypartSchedulableForParticipant(groupMatrix, participantMatrix, datum, iddagdeel)) {
    throw new SchedulableDaypartError(
      'Dit dagdeel is niet beschikbaar voor deze deelnemer/waarneemgroep'
    );
  }
}

export async function assertWeekdayDaypartSchedulable(
  idwaarneemgroep: number,
  weekdag: number,
  iddagdeel: number
): Promise<void> {
  const matrix = await loadSchedulableDayparts(idwaarneemgroep);
  if (!isDaypartSchedulable(matrix, weekdag, iddagdeel)) {
    throw new SchedulableDaypartError('Dit dagdeel is niet inplanbaar voor deze weekdag.');
  }
}

export async function replaceSchedulableDayparts(
  idwaarneemgroep: number,
  cells: ReadonlyArray<{ weekdag: number; iddagdeel: number; actief: boolean }>,
  updatedBy: number | null
): Promise<PraktijkplannerSchedulableDaypart[]> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.praktijkplannerdagdelen)
      .where(eq(schema.praktijkplannerdagdelen.idwaarneemgroep, idwaarneemgroep));

    if (cells.length === 0) return;

    await tx.insert(schema.praktijkplannerdagdelen).values(
      cells.map((cell) => ({
        idwaarneemgroep,
        weekdag: cell.weekdag,
        iddagdeel: cell.iddagdeel,
        actief: cell.actief,
        updatedBy,
      }))
    );
  });

  return loadSchedulableDayparts(idwaarneemgroep);
}

export async function replaceParticipantSchedulableDayparts(
  idwaarneemgroep: number,
  iddeelnemer: number,
  cells: ReadonlyArray<{ weekdag: number; iddagdeel: number; actief: boolean }>,
  updatedBy: number | null
): Promise<PraktijkplannerParticipantSchedulableDaypart[]> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.praktijkplannerdeelnemerdagdelen)
      .where(
        and(
          eq(schema.praktijkplannerdeelnemerdagdelen.idwaarneemgroep, idwaarneemgroep),
          eq(schema.praktijkplannerdeelnemerdagdelen.iddeelnemer, iddeelnemer)
        )
      );

    if (cells.length === 0) return;

    await tx.insert(schema.praktijkplannerdeelnemerdagdelen).values(
      cells.map((cell) => ({
        idwaarneemgroep,
        iddeelnemer,
        weekdag: cell.weekdag,
        iddagdeel: cell.iddagdeel,
        actief: cell.actief,
        updatedBy,
      }))
    );
  });

  return loadParticipantSchedulableDayparts(idwaarneemgroep, iddeelnemer);
}

export async function allDaypartIds(): Promise<number[]> {
  const rows = await db.select({ id: schema.dagdelen.id }).from(schema.dagdelen);
  return rows.filter((row): row is { id: number } => row.id != null).map((row) => row.id);
}
