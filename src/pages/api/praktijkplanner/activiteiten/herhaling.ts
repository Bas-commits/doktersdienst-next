import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { addDays, isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';

type Data =
  | {
      series: Array<{
        id: number;
        iddeelnemer: number;
        startdatum: string;
        einddatum: string;
        frequentieWeken: number;
      }>;
    }
  | { success: true; id?: number }
  | { error: string };

type PlannerTemplate = {
  datum: string;
  iddagdeel: number;
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  idbeschikbaarheidstype: number | null;
  tasks: Array<{ idtaaktype: number; positie: number }>;
};

class RecurrenceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400
  ) {
    super(message);
  }
}

function readDate(value: unknown, field: string): string {
  if (!isIsoDate(value)) throw new RecurrenceError(`${field} moet een geldige datum zijn.`);
  return value;
}

function datesForFrequency(start: string, end: string, frequencyWeeks: number): string[] {
  const result: string[] = [];
  const intervalDays = frequencyWeeks * 7;
  for (let next = start; next <= end; next = addDays(next, intervalDays)) {
    result.push(next);
  }
  return result;
}

async function getTemplates(
  idwaarneemgroep: number,
  iddeelnemer: number,
  sourceStart: string
): Promise<PlannerTemplate[]> {
  const sourceEnd = addDays(sourceStart, 6);
  const slotRows = await db
    .select({
      id: schema.planning.id,
      datum: schema.planning.datum,
      iddagdeel: schema.planning.iddagdeel,
      idactiviteit: schema.planning.idactiviteit,
      idactiviteitspecificatie: schema.planning.idactiviteitspecificatie,
      idplannerlocatie: schema.planning.idplannerlocatie,
      idbeschikbaarheidstype: schema.planningbeschikbaarheid.idbeschikbaarheidstype,
    })
    .from(schema.planning)
    .leftJoin(
      schema.planningbeschikbaarheid,
      eq(schema.planningbeschikbaarheid.idplanning, schema.planning.id)
    )
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, idwaarneemgroep),
        eq(schema.planning.iddeelnemer, iddeelnemer),
        gte(schema.planning.datum, sourceStart),
        lte(schema.planning.datum, sourceEnd)
      )
    )
    .orderBy(asc(schema.planning.datum), asc(schema.planning.iddagdeel));

  if (slotRows.length === 0) {
    throw new RecurrenceError('De bronweek bevat geen activiteitenplanning.');
  }

  const ids = slotRows.map((row) => row.id).filter((id): id is number => id != null);
  const tasks = ids.length
    ? await db
        .select({
          idplanning: schema.planningtaak.idplanning,
          idtaaktype: schema.planningtaak.idtaaktype,
          positie: schema.planningtaak.positie,
        })
        .from(schema.planningtaak)
        .where(inArray(schema.planningtaak.idplanning, ids))
    : [];
  const taskMap = new Map<number, Array<{ idtaaktype: number; positie: number }>>();
  for (const task of tasks) {
    if (task.idplanning == null || task.idtaaktype == null || task.positie == null) continue;
    const list = taskMap.get(task.idplanning) ?? [];
    list.push({ idtaaktype: task.idtaaktype, positie: task.positie });
    taskMap.set(task.idplanning, list);
  }

  return slotRows
    .filter(
      (
        row
      ): row is typeof row & {
        id: number;
        datum: string;
        iddagdeel: number;
      } => row.id != null && row.datum != null && row.iddagdeel != null
    )
    .map((row) => ({
      datum: row.datum,
      iddagdeel: row.iddagdeel,
      idactiviteit: row.idactiviteit,
      idactiviteitspecificatie: row.idactiviteitspecificatie,
      idplannerlocatie: row.idplannerlocatie,
      idbeschikbaarheidstype: row.idbeschikbaarheidstype,
      tasks: taskMap.get(row.id) ?? [],
    }));
}

/**
 * The first materialized week is persisted as the recurrence's template via
 * `is_bronslot`; rebuilding a series therefore never has to infer values from
 * unrelated planning rows in the same week.
 */
async function getSeriesTemplates(idherhaling: number): Promise<PlannerTemplate[]> {
  const slotRows = await db
    .select({
      id: schema.planning.id,
      datum: schema.planning.datum,
      iddagdeel: schema.planning.iddagdeel,
      idactiviteit: schema.planning.idactiviteit,
      idactiviteitspecificatie: schema.planning.idactiviteitspecificatie,
      idplannerlocatie: schema.planning.idplannerlocatie,
      idbeschikbaarheidstype: schema.planningbeschikbaarheid.idbeschikbaarheidstype,
    })
    .from(schema.planningherhalingslots)
    .innerJoin(schema.planning, eq(schema.planningherhalingslots.idplanning, schema.planning.id))
    .leftJoin(
      schema.planningbeschikbaarheid,
      eq(schema.planningbeschikbaarheid.idplanning, schema.planning.id)
    )
    .where(
      and(
        eq(schema.planningherhalingslots.idherhaling, idherhaling),
        eq(schema.planningherhalingslots.isBronslot, true)
      )
    )
    .orderBy(asc(schema.planning.datum), asc(schema.planning.iddagdeel));
  if (slotRows.length === 0) {
    throw new RecurrenceError('De herhaling heeft geen bewaarbaar bronslot.', 409);
  }

  const ids = slotRows.map((row) => row.id).filter((id): id is number => id != null);
  const tasks = await db
    .select({
      idplanning: schema.planningtaak.idplanning,
      idtaaktype: schema.planningtaak.idtaaktype,
      positie: schema.planningtaak.positie,
    })
    .from(schema.planningtaak)
    .where(inArray(schema.planningtaak.idplanning, ids));
  const taskMap = new Map<number, Array<{ idtaaktype: number; positie: number }>>();
  for (const task of tasks) {
    if (task.idplanning == null || task.idtaaktype == null || task.positie == null) continue;
    const entries = taskMap.get(task.idplanning) ?? [];
    entries.push({ idtaaktype: task.idtaaktype, positie: task.positie });
    taskMap.set(task.idplanning, entries);
  }

  return slotRows
    .filter(
      (
        row
      ): row is typeof row & {
        id: number;
        datum: string;
        iddagdeel: number;
      } => row.id != null && row.datum != null && row.iddagdeel != null
    )
    .map((row) => ({
      datum: row.datum,
      iddagdeel: row.iddagdeel,
      idactiviteit: row.idactiviteit,
      idactiviteitspecificatie: row.idactiviteitspecificatie,
      idplannerlocatie: row.idplannerlocatie,
      idbeschikbaarheidstype: row.idbeschikbaarheidstype,
      tasks: taskMap.get(row.id) ?? [],
    }));
}

async function assertNoTargetCollision(
  idwaarneemgroep: number,
  iddeelnemer: number,
  targetStarts: string[],
  ignoredPlanningIds: readonly number[] = []
) {
  const ignored = new Set(ignoredPlanningIds);
  for (const targetStart of targetStarts) {
    const targetEnd = addDays(targetStart, 6);
    const candidates = await db
      .select({ id: schema.planning.id })
      .from(schema.planning)
      .where(
        and(
          eq(schema.planning.idwaarneemgroep, idwaarneemgroep),
          eq(schema.planning.iddeelnemer, iddeelnemer),
          gte(schema.planning.datum, targetStart),
          lte(schema.planning.datum, targetEnd)
        )
      );
    if (candidates.some((candidate) => candidate.id != null && !ignored.has(candidate.id))) {
      throw new RecurrenceError(
        `Er bestaat al een planning in de doelweek van ${targetStart}.`,
        409
      );
    }
  }
}

async function materializeSeries(input: {
  idherhaling: number;
  idwaarneemgroep: number;
  iddeelnemer: number;
  sourceStart: string;
  targetStarts: string[];
  templates: PlannerTemplate[];
  userId: number;
}) {
  await db.transaction(async (tx) => {
    for (const targetStart of input.targetStarts) {
      for (const template of input.templates) {
        const offset = Math.round(
          (new Date(`${template.datum}T12:00:00`).getTime() -
            new Date(`${input.sourceStart}T12:00:00`).getTime()) /
            (24 * 60 * 60 * 1000)
        );
        const datum = addDays(targetStart, offset);
        const [created] = await tx
          .insert(schema.planning)
          .values({
            idwaarneemgroep: input.idwaarneemgroep,
            iddeelnemer: input.iddeelnemer,
            datum,
            iddagdeel: template.iddagdeel,
            idactiviteit: template.idactiviteit,
            idactiviteitspecificatie: template.idactiviteitspecificatie,
            idplannerlocatie: template.idplannerlocatie,
            createdBy: input.userId,
            updatedBy: input.userId,
          })
          .returning({ id: schema.planning.id });
        if (!created?.id) throw new RecurrenceError('Herhaling kon niet worden opgeslagen.');
        if (template.tasks.length > 0) {
          await tx.insert(schema.planningtaak).values(
            template.tasks.map((task) => ({
              idplanning: created.id,
              idtaaktype: task.idtaaktype,
              positie: task.positie,
            }))
          );
        }
        if (template.idbeschikbaarheidstype != null) {
          await tx.insert(schema.planningbeschikbaarheid).values({
            idplanning: created.id,
            idbeschikbaarheidstype: template.idbeschikbaarheidstype,
            updatedBy: input.userId,
          });
        }
        await tx.insert(schema.planningherhalingslots).values({
          idherhaling: input.idherhaling,
          idplanning: created.id,
          reeksdatum: datum,
          isBronslot: targetStart === input.targetStarts[0],
        });
      }
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      Array.isArray(req.query.idwaarneemgroep)
        ? req.query.idwaarneemgroep[0]
        : req.query.idwaarneemgroep,
      'activiteiten:manage'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);
    const iddeelnemer = parsePositiveInteger(
      Array.isArray(req.query.iddeelnemer) ? req.query.iddeelnemer[0] : req.query.iddeelnemer
    );
    try {
      const rows = await db
        .select({
          id: schema.planningherhalingen.id,
          iddeelnemer: schema.planningherhalingen.iddeelnemer,
          startdatum: schema.planningherhalingen.startdatum,
          einddatum: schema.planningherhalingen.einddatum,
          frequentieWeken: schema.planningherhalingen.frequentieWeken,
        })
        .from(schema.planningherhalingen)
        .where(
          iddeelnemer
            ? and(
                eq(schema.planningherhalingen.idwaarneemgroep, accessResult.access.idwaarneemgroep),
                eq(schema.planningherhalingen.iddeelnemer, iddeelnemer)
              )
            : eq(schema.planningherhalingen.idwaarneemgroep, accessResult.access.idwaarneemgroep)
        )
        .orderBy(asc(schema.planningherhalingen.startdatum));
      return res.status(200).json({
        series: rows
          .filter(
            (
              row
            ): row is typeof row & {
              id: number;
              iddeelnemer: number;
              startdatum: string;
              einddatum: string;
              frequentieWeken: number;
            } =>
              row.id != null &&
              row.iddeelnemer != null &&
              row.startdatum != null &&
              row.einddatum != null &&
              row.frequentieWeken != null
          )
          .map((row) => ({
            id: row.id,
            iddeelnemer: row.iddeelnemer,
            startdatum: row.startdatum,
            einddatum: row.einddatum,
            frequentieWeken: row.frequentieWeken,
          })),
      });
    } catch (error) {
      console.error('[praktijkplanner/activiteiten/herhaling GET]', error);
      return res.status(500).json({ error: 'Herhalingen konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'activiteiten:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  try {
    if (action === 'create' || action === 'copyWeek') {
      const iddeelnemer = parsePositiveInteger(body.iddeelnemer);
      const bronStartdatum = readDate(body.bronStartdatum, 'Bronstartdatum');
      const startdatum = readDate(body.startdatum ?? body.doelStartdatum, 'Startdatum');
      const einddatum = readDate(body.einddatum ?? body.doelStartdatum, 'Einddatum');
      const frequencyWeeks = action === 'copyWeek' ? 1 : parsePositiveInteger(body.frequentieWeken);

      if (!iddeelnemer || !frequencyWeeks || frequencyWeeks > 3 || startdatum > einddatum) {
        throw new RecurrenceError('De herhalingsinstellingen zijn ongeldig.');
      }
      if (
        !(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer, {
          requireManager: true,
        }))
      ) {
        throw new RecurrenceError('Geen toegang tot deze deelnemer.', 403);
      }

      const templates = await getTemplates(
        accessResult.access.idwaarneemgroep,
        iddeelnemer,
        bronStartdatum
      );
      const targetStarts = action === 'copyWeek' ? [startdatum] : datesForFrequency(startdatum, einddatum, frequencyWeeks);
      if (targetStarts.includes(bronStartdatum)) {
        throw new RecurrenceError('De doelweek moet verschillen van de bronweek.');
      }
      await assertNoTargetCollision(
        accessResult.access.idwaarneemgroep,
        iddeelnemer,
        targetStarts
      );

      if (action === 'copyWeek') {
        const [copy] = await db
          .insert(schema.planningherhalingen)
          .values({
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            iddeelnemer,
            startdatum,
            einddatum: startdatum,
            frequentieWeken: 1,
            createdBy: accessResult.access.user.id,
            updatedBy: accessResult.access.user.id,
          })
          .returning({ id: schema.planningherhalingen.id });
        if (!copy?.id) throw new RecurrenceError('Kopiëren kon niet worden gestart.');
        await materializeSeries({
          idherhaling: copy.id,
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          iddeelnemer,
          sourceStart: bronStartdatum,
          targetStarts,
          templates,
          userId: accessResult.access.user.id,
        });
        return res.status(201).json({ success: true, id: copy.id });
      }

      const [series] = await db
        .insert(schema.planningherhalingen)
        .values({
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          iddeelnemer,
          startdatum,
          einddatum,
          frequentieWeken: frequencyWeeks,
          createdBy: accessResult.access.user.id,
          updatedBy: accessResult.access.user.id,
        })
        .returning({ id: schema.planningherhalingen.id });
      if (!series?.id) throw new RecurrenceError('Herhaling kon niet worden aangemaakt.');
      await materializeSeries({
        idherhaling: series.id,
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        iddeelnemer,
        sourceStart: bronStartdatum,
        targetStarts,
        templates,
        userId: accessResult.access.user.id,
      });
      return res.status(201).json({ success: true, id: series.id });
    }

    const idherhaling = parsePositiveInteger(body.idherhaling);
    if (!idherhaling) throw new RecurrenceError('Een geldige herhaling is verplicht.');
    const [series] = await db
      .select({
        id: schema.planningherhalingen.id,
        iddeelnemer: schema.planningherhalingen.iddeelnemer,
        startdatum: schema.planningherhalingen.startdatum,
        einddatum: schema.planningherhalingen.einddatum,
        frequentieWeken: schema.planningherhalingen.frequentieWeken,
      })
      .from(schema.planningherhalingen)
      .where(
        and(
          eq(schema.planningherhalingen.id, idherhaling),
          eq(schema.planningherhalingen.idwaarneemgroep, accessResult.access.idwaarneemgroep)
        )
      )
      .limit(1);
    if (
      !series?.id ||
      series.iddeelnemer == null ||
      series.startdatum == null ||
      series.einddatum == null ||
      series.frequentieWeken == null
    ) {
      throw new RecurrenceError('Herhaling niet gevonden.', 404);
    }

    if (action === 'delete') {
      const vanaf = body.vanaf ? readDate(body.vanaf, 'Vanaf') : null;
      const tot = body.tot ? readDate(body.tot, 'Tot') : null;
      const linked = await db
        .select({
          idplanning: schema.planningherhalingslots.idplanning,
          reeksdatum: schema.planningherhalingslots.reeksdatum,
        })
        .from(schema.planningherhalingslots)
        .where(eq(schema.planningherhalingslots.idherhaling, idherhaling));
      const idsToDelete = linked
        .filter(
          (row) =>
            row.idplanning != null &&
            row.reeksdatum != null &&
            (!vanaf || row.reeksdatum >= vanaf) &&
            (!tot || row.reeksdatum <= tot)
        )
        .map((row) => row.idplanning as number);
      if (idsToDelete.length === 0) {
        throw new RecurrenceError('Er zijn geen herhalingsslots in dit bereik.', 404);
      }
      await db.transaction(async (tx) => {
        await tx.delete(schema.planning).where(inArray(schema.planning.id, idsToDelete));
        const remaining = await tx
          .select({ reeksdatum: schema.planningherhalingslots.reeksdatum })
          .from(schema.planningherhalingslots)
          .where(eq(schema.planningherhalingslots.idherhaling, idherhaling));
        if (remaining.length === 0) {
          await tx.delete(schema.planningherhalingen).where(eq(schema.planningherhalingen.id, idherhaling));
        } else {
          const values = remaining
            .map((row) => row.reeksdatum)
            .filter((value): value is string => value != null)
            .sort();
          await tx
            .update(schema.planningherhalingen)
            .set({
              startdatum: values[0],
              einddatum: values[values.length - 1],
              updatedBy: accessResult.access.user.id,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.planningherhalingen.id, idherhaling));
        }
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'edit') {
      const startdatum = readDate(body.startdatum, 'Startdatum');
      const einddatum = readDate(body.einddatum, 'Einddatum');
      const frequentieWeken = parsePositiveInteger(body.frequentieWeken);
      if (!frequentieWeken || frequentieWeken > 3 || startdatum > einddatum) {
        throw new RecurrenceError('De herhalingsinstellingen zijn ongeldig.');
      }

      const [templates, linked] = await Promise.all([
        getSeriesTemplates(idherhaling),
        db
          .select({ idplanning: schema.planningherhalingslots.idplanning })
          .from(schema.planningherhalingslots)
          .where(eq(schema.planningherhalingslots.idherhaling, idherhaling)),
      ]);
      const linkedPlanningIds = linked
        .map((row) => row.idplanning)
        .filter((id): id is number => id != null);
      const targetStarts = datesForFrequency(startdatum, einddatum, frequentieWeken);
      await assertNoTargetCollision(
        accessResult.access.idwaarneemgroep,
        series.iddeelnemer,
        targetStarts,
        linkedPlanningIds
      );

      await db.transaction(async (tx) => {
        if (linkedPlanningIds.length > 0) {
          await tx.delete(schema.planning).where(inArray(schema.planning.id, linkedPlanningIds));
        }
        await tx
          .update(schema.planningherhalingen)
          .set({
            startdatum,
            einddatum,
            frequentieWeken,
            updatedBy: accessResult.access.user.id,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.planningherhalingen.id, idherhaling));

        for (const targetStart of targetStarts) {
          for (const template of templates) {
            const offset = Math.round(
              (new Date(`${template.datum}T12:00:00`).getTime() -
                new Date(`${series.startdatum}T12:00:00`).getTime()) /
                (24 * 60 * 60 * 1000)
            );
            const datum = addDays(targetStart, offset);
            const [created] = await tx
              .insert(schema.planning)
              .values({
                idwaarneemgroep: accessResult.access.idwaarneemgroep,
                iddeelnemer: series.iddeelnemer,
                datum,
                iddagdeel: template.iddagdeel,
                idactiviteit: template.idactiviteit,
                idactiviteitspecificatie: template.idactiviteitspecificatie,
                idplannerlocatie: template.idplannerlocatie,
                createdBy: accessResult.access.user.id,
                updatedBy: accessResult.access.user.id,
              })
              .returning({ id: schema.planning.id });
            if (!created?.id) throw new RecurrenceError('Herhaling kon niet worden bijgewerkt.');
            if (template.tasks.length > 0) {
              await tx.insert(schema.planningtaak).values(
                template.tasks.map((task) => ({
                  idplanning: created.id,
                  idtaaktype: task.idtaaktype,
                  positie: task.positie,
                }))
              );
            }
            if (template.idbeschikbaarheidstype != null) {
              await tx.insert(schema.planningbeschikbaarheid).values({
                idplanning: created.id,
                idbeschikbaarheidstype: template.idbeschikbaarheidstype,
                updatedBy: accessResult.access.user.id,
              });
            }
            await tx.insert(schema.planningherhalingslots).values({
              idherhaling,
              idplanning: created.id,
              reeksdatum: datum,
              isBronslot: targetStart === targetStarts[0],
            });
          }
        }
      });
      return res.status(200).json({ success: true, id: idherhaling });
    }

    return res.status(400).json({ error: 'Ongeldige herhalingsactie.' });
  } catch (error) {
    if (error instanceof RecurrenceError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[praktijkplanner/activiteiten/herhaling]', error);
    return res.status(500).json({ error: 'De herhalingsactie kon niet worden uitgevoerd.' });
  }
}
