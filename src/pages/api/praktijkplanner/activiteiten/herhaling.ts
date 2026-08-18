import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { addDays, isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import { dienstTaaktypeIds } from '@/lib/praktijkplanner/dienst-taaktypen';
import {
  buildMaterializePlans,
  plannenZonderDiensten,
  occurrenceKey,
  type PlannerTemplate,
} from '@/lib/praktijkplanner/herhaling-materialize';
import { isDaypartSchedulableForParticipant } from '@/lib/praktijkplanner/schedulable-dayparts';
import {
  loadParticipantSchedulableDayparts,
  loadSchedulableDayparts,
} from '@/lib/praktijkplanner/schedulable-dayparts-db';

type Data =
  | {
      series: Array<{
        id: number;
        iddeelnemer: number;
        startdatum: string;
        einddatum: string;
        frequentieWeken: number;
        bronstartdatum: string | null;
      }>;
    }
  | { success: true; id?: number }
  | { error: string };

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

/**
 * The source week is part of the series, but it is never regenerated or deleted along with
 * it: the planner typed that week in by hand and every repeated week is derived from it.
 * Rebuilding or clearing a pattern must leave it standing.
 */
function isInSourceWeek(reeksdatum: string, bronstartdatum: string | null): boolean {
  if (!bronstartdatum) return false;
  return reeksdatum >= bronstartdatum && reeksdatum <= addDays(bronstartdatum, 6);
}

/**
 * Ties the hand-made planning of the source week to the new series, so pasting a fiche over
 * that week is flagged as a deviation just like pasting over a repeated week.
 *
 * Slots that already belong to another series are left alone. `planningherhalingslots`
 * permits one series per planning row, so claiming them would move those slots out of their
 * own pattern (and violate the unique constraint on the way).
 */
async function linkSourceWeek(
  // Drizzle transaction client — same insert/query surface as `db`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: {
    idherhaling: number;
    idwaarneemgroep: number;
    iddeelnemer: number;
    sourceStart: string;
  }
): Promise<void> {
  const unlinked = await tx
    .select({ id: schema.planning.id, datum: schema.planning.datum })
    .from(schema.planning)
    .leftJoin(
      schema.planningherhalingslots,
      eq(schema.planningherhalingslots.idplanning, schema.planning.id)
    )
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, input.idwaarneemgroep),
        eq(schema.planning.iddeelnemer, input.iddeelnemer),
        gte(schema.planning.datum, input.sourceStart),
        lte(schema.planning.datum, addDays(input.sourceStart, 6)),
        isNull(schema.planningherhalingslots.idplanning)
      )
    );

  const links = (unlinked as Array<{ id: number | null; datum: string | null }>)
    .filter((row): row is { id: number; datum: string } => row.id != null && row.datum != null)
    .map((row) => ({
      idherhaling: input.idherhaling,
      idplanning: row.id,
      reeksdatum: row.datum,
      // Not a bronslot: that flag marks the stored template copy, and a slot carrying it is
      // exempt from the deviation warning — exactly what this week now needs to get.
      isBronslot: false,
      isUitzondering: false,
    }));
  if (links.length > 0) {
    await tx.insert(schema.planningherhalingslots).values(links);
  }
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

async function loadSkipKeys(idherhaling: number): Promise<Set<string>> {
  const [tombstones, exceptionSlots] = await Promise.all([
    db
      .select({
        reeksdatum: schema.planningherhalinguitzonderingen.reeksdatum,
        iddagdeel: schema.planningherhalinguitzonderingen.iddagdeel,
      })
      .from(schema.planningherhalinguitzonderingen)
      .where(eq(schema.planningherhalinguitzonderingen.idherhaling, idherhaling)),
    db
      .select({
        reeksdatum: schema.planningherhalingslots.reeksdatum,
        iddagdeel: schema.planning.iddagdeel,
      })
      .from(schema.planningherhalingslots)
      .innerJoin(schema.planning, eq(schema.planningherhalingslots.idplanning, schema.planning.id))
      .where(
        and(
          eq(schema.planningherhalingslots.idherhaling, idherhaling),
          eq(schema.planningherhalingslots.isUitzondering, true)
        )
      ),
  ]);
  const keys = new Set<string>();
  for (const row of tombstones) {
    if (row.reeksdatum != null && row.iddagdeel != null) {
      keys.add(occurrenceKey(row.reeksdatum, row.iddagdeel));
    }
  }
  for (const row of exceptionSlots) {
    if (row.reeksdatum != null && row.iddagdeel != null) {
      keys.add(occurrenceKey(row.reeksdatum, row.iddagdeel));
    }
  }
  return keys;
}

async function collectTargetPlanningIds(
  idwaarneemgroep: number,
  iddeelnemer: number,
  targetStarts: string[],
  ignoredPlanningIds: readonly number[] = []
): Promise<number[]> {
  if (targetStarts.length === 0) return [];
  const ignored = new Set(ignoredPlanningIds);
  const weekFilters = targetStarts.map((targetStart) =>
    and(gte(schema.planning.datum, targetStart), lte(schema.planning.datum, addDays(targetStart, 6)))
  );
  const candidates = await db
    .select({ id: schema.planning.id })
    .from(schema.planning)
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, idwaarneemgroep),
        eq(schema.planning.iddeelnemer, iddeelnemer),
        or(...weekFilters)
      )
    );
  const ids = candidates
    .map((candidate) => candidate.id)
    .filter((id): id is number => id != null && !ignored.has(id));
  if (ids.length === 0) return ids;

  /*
    Planning met een dienst telt hier niet mee, en dat werkt twee kanten op omdat deze lijst
    twee dingen voedt: wat er in de doelweken wordt weggegooid, en de botsingscontrole die met
    een 409 afbreekt. Zonder deze uitzondering zou een herhaling een dienst overschrijven, of
    zou een enkele nachtdienst de hele reeks blokkeren met de melding dat er al planning staat.
  */
  const dienstIds = await dienstTaaktypeIds(idwaarneemgroep);
  if (dienstIds.size === 0) return ids;
  const metDienst = await db
    .select({ idplanning: schema.planningtaak.idplanning })
    .from(schema.planningtaak)
    .where(
      and(
        inArray(schema.planningtaak.idplanning, ids),
        inArray(schema.planningtaak.idtaaktype, [...dienstIds])
      )
    );
  const beschermd = new Set(metDienst.flatMap((rij) => (rij.idplanning == null ? [] : [rij.idplanning])));
  return ids.filter((id) => !beschermd.has(id));
}

async function assertNoTargetCollision(
  idwaarneemgroep: number,
  iddeelnemer: number,
  targetStarts: string[],
  ignoredPlanningIds: readonly number[] = []
) {
  const colliding = await collectTargetPlanningIds(
    idwaarneemgroep,
    iddeelnemer,
    targetStarts,
    ignoredPlanningIds
  );
  if (colliding.length > 0) {
    throw new RecurrenceError('Er bestaat al een planning in een of meer doelweken.', 409);
  }
}

/** Deletes existing planning in target weeks (cascades tasks, availability, herhalingslots). */
async function clearTargetWeeksPlanning(
  idwaarneemgroep: number,
  iddeelnemer: number,
  targetStarts: string[]
) {
  const ids = await collectTargetPlanningIds(idwaarneemgroep, iddeelnemer, targetStarts);
  if (ids.length === 0) return;
  await db.delete(schema.planning).where(inArray(schema.planning.id, ids));
}

async function materializeSeriesWithTx(
  // Drizzle transaction client — same insert/query surface as `db`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: {
    idherhaling: number;
    idwaarneemgroep: number;
    iddeelnemer: number;
    sourceStart: string;
    targetStarts: string[];
    templates: PlannerTemplate[];
    userId: number;
    skipKeys?: ReadonlySet<string>;
    includeSourceWeek?: boolean;
  }
) {
  if (input.includeSourceWeek) {
    await linkSourceWeek(tx, {
      idherhaling: input.idherhaling,
      idwaarneemgroep: input.idwaarneemgroep,
      iddeelnemer: input.iddeelnemer,
      sourceStart: input.sourceStart,
    });
  }

  const alleplans = buildMaterializePlans({
    sourceStart: input.sourceStart,
    targetStarts: input.targetStarts,
    templates: input.templates,
    skipKeys: input.skipKeys,
  });
  // Het filter staat hier en niet bij het opbouwen van de sjablonen, omdat er twee bronnen zijn
  // (de bronweek en de opgeslagen bronslots van een bestaande reeks) en dit de plek is waar ze
  // allebei langskomen.
  const plans = plannenZonderDiensten(
    alleplans,
    await dienstTaaktypeIds(input.idwaarneemgroep)
  );
  const schedulableMatrix = await loadSchedulableDayparts(input.idwaarneemgroep);
  const participantRows = await loadParticipantSchedulableDayparts(
    input.idwaarneemgroep,
    input.iddeelnemer
  );
  const participantMatrix = participantRows.map(({ weekdag, iddagdeel, actief }) => ({
    weekdag,
    iddagdeel,
    actief,
  }));
  const schedulablePlans = plans.filter((plan) =>
    isDaypartSchedulableForParticipant(
      schedulableMatrix,
      participantMatrix,
      plan.datum,
      plan.iddagdeel
    )
  );
  if (schedulablePlans.length === 0) return;

  const created = await tx
    .insert(schema.planning)
    .values(
      schedulablePlans.map((plan) => ({
        idwaarneemgroep: input.idwaarneemgroep,
        iddeelnemer: input.iddeelnemer,
        datum: plan.datum,
        iddagdeel: plan.iddagdeel,
        idactiviteit: plan.idactiviteit,
        idactiviteitspecificatie: plan.idactiviteitspecificatie,
        idplannerlocatie: plan.idplannerlocatie,
        createdBy: input.userId,
        updatedBy: input.userId,
      }))
    )
    .returning({
      id: schema.planning.id,
      datum: schema.planning.datum,
      iddagdeel: schema.planning.iddagdeel,
    });

  const idByKey = new Map<string, number>();
  for (const row of created as Array<{ id: number | null; datum: string | null; iddagdeel: number | null }>) {
    if (row.id == null || row.datum == null || row.iddagdeel == null) continue;
    idByKey.set(occurrenceKey(row.datum, row.iddagdeel), row.id);
  }

  const tasks = schedulablePlans.flatMap((plan) => {
    const idplanning = idByKey.get(occurrenceKey(plan.datum, plan.iddagdeel));
    if (idplanning == null) return [];
    return plan.tasks.map((task) => ({
      idplanning,
      idtaaktype: task.idtaaktype,
      positie: task.positie,
    }));
  });
  if (tasks.length > 0) {
    await tx.insert(schema.planningtaak).values(tasks);
  }

  const availability = schedulablePlans.flatMap((plan) => {
    if (plan.idbeschikbaarheidstype == null) return [];
    const idplanning = idByKey.get(occurrenceKey(plan.datum, plan.iddagdeel));
    if (idplanning == null) return [];
    return [
      {
        idplanning,
        idbeschikbaarheidstype: plan.idbeschikbaarheidstype,
        updatedBy: input.userId,
      },
    ];
  });
  if (availability.length > 0) {
    await tx.insert(schema.planningbeschikbaarheid).values(availability);
  }

  const links = schedulablePlans.flatMap((plan) => {
    const idplanning = idByKey.get(occurrenceKey(plan.datum, plan.iddagdeel));
    if (idplanning == null) return [];
    return [
      {
        idherhaling: input.idherhaling,
        idplanning,
        reeksdatum: plan.datum,
        isBronslot: plan.isBronslot,
        isUitzondering: false,
      },
    ];
  });
  if (links.length > 0) {
    await tx.insert(schema.planningherhalingslots).values(links);
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
  skipKeys?: ReadonlySet<string>;
  includeSourceWeek?: boolean;
}) {
  await db.transaction(async (tx) => {
    await materializeSeriesWithTx(tx, input);
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
          bronstartdatum: schema.planningherhalingen.bronstartdatum,
        })
        .from(schema.planningherhalingen)
        .where(
          and(
            eq(schema.planningherhalingen.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            // Week copies live in this table too, but they are not patterns the planner can
            // edit or extend. Listing them offered a Verwijderen that deletes real planning.
            eq(schema.planningherhalingen.isKopie, false),
            ...(iddeelnemer
              ? [eq(schema.planningherhalingen.iddeelnemer, iddeelnemer)]
              : [])
          )
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
            bronstartdatum: row.bronstartdatum ?? null,
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
      const targetStarts =
        action === 'copyWeek' ? [startdatum] : datesForFrequency(startdatum, einddatum, frequencyWeeks);
      if (targetStarts.includes(bronStartdatum)) {
        throw new RecurrenceError('De doelweek moet verschillen van de bronweek.');
      }
      const overwrite = body.overwrite === true;
      if (overwrite) {
        await clearTargetWeeksPlanning(
          accessResult.access.idwaarneemgroep,
          iddeelnemer,
          targetStarts
        );
      } else {
        await assertNoTargetCollision(
          accessResult.access.idwaarneemgroep,
          iddeelnemer,
          targetStarts
        );
      }

      if (action === 'copyWeek') {
        const [copy] = await db
          .insert(schema.planningherhalingen)
          .values({
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            iddeelnemer,
            startdatum,
            einddatum: startdatum,
            frequentieWeken: 1,
            // A copy is a one-off, not a pattern. The row exists only so the copied slots
            // have a parent to link to; the flag keeps it out of "Herhalingen beheren".
            isKopie: true,
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
          bronstartdatum: bronStartdatum,
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
        // A copy is a one-off and gets no source week: linking it would put a pattern on a
        // week the planner never asked to repeat.
        includeSourceWeek: true,
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
        bronstartdatum: schema.planningherhalingen.bronstartdatum,
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
    const bronstartdatum = series.bronstartdatum ?? null;

    if (action === 'delete') {
      const mode = body.mode === 'deletePlanning' ? 'deletePlanning' : 'unlink';
      const vanaf = body.vanaf ? readDate(body.vanaf, 'Vanaf') : null;
      const tot = body.tot ? readDate(body.tot, 'Tot') : null;
      const linked = await db
        .select({
          idplanning: schema.planningherhalingslots.idplanning,
          reeksdatum: schema.planningherhalingslots.reeksdatum,
        })
        .from(schema.planningherhalingslots)
        .where(eq(schema.planningherhalingslots.idherhaling, idherhaling));
      const matching = linked.filter(
        (row) =>
          row.idplanning != null &&
          row.reeksdatum != null &&
          (!vanaf || row.reeksdatum >= vanaf) &&
          (!tot || row.reeksdatum <= tot)
      );
      const idsInRange = matching.map((row) => row.idplanning as number);

      if (mode === 'unlink') {
        // Delete series (cascades links + uitzonderingen); keep planning rows.
        if (!vanaf && !tot) {
          await db
            .delete(schema.planningherhalingen)
            .where(eq(schema.planningherhalingen.id, idherhaling));
          return res.status(200).json({ success: true });
        }
        if (idsInRange.length === 0) {
          throw new RecurrenceError('Er zijn geen herhalingsslots in dit bereik.', 404);
        }
        await db.transaction(async (tx) => {
          await tx
            .delete(schema.planningherhalingslots)
            .where(
              and(
                eq(schema.planningherhalingslots.idherhaling, idherhaling),
                inArray(schema.planningherhalingslots.idplanning, idsInRange)
              )
            );
          await tx
            .delete(schema.planningherhalinguitzonderingen)
            .where(
              and(
                eq(schema.planningherhalinguitzonderingen.idherhaling, idherhaling),
                vanaf ? gte(schema.planningherhalinguitzonderingen.reeksdatum, vanaf) : sql`true`,
                tot ? lte(schema.planningherhalinguitzonderingen.reeksdatum, tot) : sql`true`
              )
            );
          const remaining = await tx
            .select({ reeksdatum: schema.planningherhalingslots.reeksdatum })
            .from(schema.planningherhalingslots)
            .where(eq(schema.planningherhalingslots.idherhaling, idherhaling));
          // The source week is not one of the repeated weeks, so it must not drag the
          // series range back onto the week the pattern was copied from.
          const remainingRepeated = remaining.filter(
            (row) => row.reeksdatum != null && !isInSourceWeek(row.reeksdatum, bronstartdatum)
          );
          if (remainingRepeated.length === 0) {
            await tx
              .delete(schema.planningherhalingen)
              .where(eq(schema.planningherhalingen.id, idherhaling));
          } else {
            const values = remainingRepeated
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

      // deletePlanning: remove linked planning (cascades links), then series if empty.
      // The source week is spared: it was planned by hand and is where every repeated week
      // came from, so clearing a pattern must not take it down as well.
      const deletableIds = matching
        .filter((row) => !isInSourceWeek(row.reeksdatum as string, bronstartdatum))
        .map((row) => row.idplanning as number);

      if (idsInRange.length === 0 && !vanaf && !tot) {
        await db
          .delete(schema.planningherhalingen)
          .where(eq(schema.planningherhalingen.id, idherhaling));
        return res.status(200).json({ success: true });
      }
      if (idsInRange.length === 0) {
        throw new RecurrenceError('Er zijn geen herhalingsslots in dit bereik.', 404);
      }
      if (!vanaf && !tot) {
        // Deleting the whole series: the leftover source-week links must go with it, or the
        // pattern would survive as a one-week series covering the week it started from.
        await db.transaction(async (tx) => {
          if (deletableIds.length > 0) {
            await tx.delete(schema.planning).where(inArray(schema.planning.id, deletableIds));
          }
          await tx
            .delete(schema.planningherhalingen)
            .where(eq(schema.planningherhalingen.id, idherhaling));
        });
        return res.status(200).json({ success: true });
      }
      await db.transaction(async (tx) => {
        if (deletableIds.length > 0) {
          await tx.delete(schema.planning).where(inArray(schema.planning.id, deletableIds));
        }
        const remaining = await tx
          .select({ reeksdatum: schema.planningherhalingslots.reeksdatum })
          .from(schema.planningherhalingslots)
          .where(eq(schema.planningherhalingslots.idherhaling, idherhaling));
        const remainingRepeated = remaining.filter(
          (row: { reeksdatum: string | null }) =>
            row.reeksdatum != null && !isInSourceWeek(row.reeksdatum, bronstartdatum)
        );
        if (remainingRepeated.length === 0) {
          await tx
            .delete(schema.planningherhalingen)
            .where(eq(schema.planningherhalingen.id, idherhaling));
        } else {
          const values = remainingRepeated
            .map((row: { reeksdatum: string | null }) => row.reeksdatum)
            .filter((value: string | null): value is string => value != null)
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

      const [templates, linked, skipKeys] = await Promise.all([
        getSeriesTemplates(idherhaling),
        db
          .select({
            idplanning: schema.planningherhalingslots.idplanning,
            reeksdatum: schema.planningherhalingslots.reeksdatum,
            isUitzondering: schema.planningherhalingslots.isUitzondering,
          })
          .from(schema.planningherhalingslots)
          .where(eq(schema.planningherhalingslots.idherhaling, idherhaling)),
        loadSkipKeys(idherhaling),
      ]);
      // Rebuilding a series throws its planning away and re-creates it from the template.
      // The source week is not re-creatable that way — it is the hand-made week the pattern
      // was taken from — so it is kept, exactly like a slot the planner already changed.
      const isSourceWeekSlot = (row: { reeksdatum: string | null }) =>
        row.reeksdatum != null && isInSourceWeek(row.reeksdatum, bronstartdatum);
      const linkedPlanningIds = linked
        .filter((row) => row.idplanning != null && !row.isUitzondering && !isSourceWeekSlot(row))
        .map((row) => row.idplanning as number);
      const keepPlanningIds = linked
        .filter((row) => row.idplanning != null && row.isUitzondering)
        .map((row) => row.idplanning as number);
      const targetStarts = datesForFrequency(startdatum, einddatum, frequentieWeken);
      // The source week is deliberately absent from the ignore list. A range that reaches
      // back over it must still collide, otherwise the rebuild would drop a second copy of
      // the planning on top of the week it was copied from.
      await assertNoTargetCollision(
        accessResult.access.idwaarneemgroep,
        series.iddeelnemer,
        targetStarts,
        [...linkedPlanningIds, ...keepPlanningIds]
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

        await materializeSeriesWithTx(tx, {
          idherhaling,
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          iddeelnemer: series.iddeelnemer,
          sourceStart: series.startdatum,
          targetStarts,
          templates,
          userId: accessResult.access.user.id,
          skipKeys,
        });
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
