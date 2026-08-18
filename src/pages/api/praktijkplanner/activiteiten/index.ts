import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import {
  assertDaypartSchedulable,
  SchedulableDaypartError,
} from '@/lib/praktijkplanner/schedulable-dayparts-db';
import type { PraktijkplannerPlanningSlot } from '@/types/praktijkplanner';

type SlotMutation = {
  iddeelnemer: unknown;
  datum: unknown;
  iddagdeel: unknown;
  idactiviteit?: unknown;
  idactiviteitspecificatie?: unknown;
  idplannerlocatie?: unknown;
  idbeschikbaarheidstype?: unknown;
  taskIds?: unknown;
  version?: unknown;
};

type Data =
  | { slots: PraktijkplannerPlanningSlot[] }
  | { success: true }
  | { error: string };

class PlannerRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 500 = 400
  ) {
    super(message);
  }
}

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nullableId(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return parsePositiveInteger(value) ?? undefined;
}

function parseTaskIds(value: unknown): number[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const ids = value.map(parsePositiveInteger);
  if (ids.some((id) => id == null)) return null;
  const uniqueIds = [...new Set(ids as number[])];
  return uniqueIds.length === ids.length ? uniqueIds : null;
}

async function assertMasterDataBelongsToGroup(
  idwaarneemgroep: number,
  mutation: {
    idactiviteit: number | null;
    idactiviteitspecificatie: number | null;
    idplannerlocatie: number | null;
    idbeschikbaarheidstype: number | null;
    taskIds: number[];
  }
) {
  if (mutation.idactiviteit != null) {
    const [activity] = await db
      .select({ id: schema.activiteiten.id })
      .from(schema.activiteiten)
      .where(
        and(
          eq(schema.activiteiten.id, mutation.idactiviteit),
          eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep),
          eq(schema.activiteiten.actief, true)
        )
      )
      .limit(1);
    if (!activity?.id) throw new PlannerRequestError('De gekozen activiteit is niet beschikbaar.', 400);
  }

  if (mutation.idactiviteitspecificatie != null) {
    if (mutation.idactiviteit == null) {
      throw new PlannerRequestError('Een specificatie vereist een activiteit.', 400);
    }
    const [specification] = await db
      .select({ id: schema.activiteitSpecificaties.id })
      .from(schema.activiteitSpecificaties)
      .where(
        and(
          eq(schema.activiteitSpecificaties.id, mutation.idactiviteitspecificatie),
          eq(schema.activiteitSpecificaties.idactiviteit, mutation.idactiviteit),
          eq(schema.activiteitSpecificaties.actief, true)
        )
      )
      .limit(1);
    if (!specification?.id) throw new PlannerRequestError('De gekozen specificatie is niet beschikbaar.', 400);
  }

  if (mutation.idplannerlocatie != null) {
    const [location] = await db
      .select({ id: schema.praktijkplannerlocaties.id })
      .from(schema.praktijkplannerlocaties)
      .where(
        and(
          eq(schema.praktijkplannerlocaties.id, mutation.idplannerlocatie),
          eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep),
          eq(schema.praktijkplannerlocaties.actief, true)
        )
      )
      .limit(1);
    if (!location?.id) throw new PlannerRequestError('De gekozen locatie is niet beschikbaar.', 400);
  }

  if (mutation.idbeschikbaarheidstype != null) {
    const [availabilityType] = await db
      .select({ id: schema.beschikbaarheidstypen.id })
      .from(schema.beschikbaarheidstypen)
      .where(
        and(
          eq(schema.beschikbaarheidstypen.id, mutation.idbeschikbaarheidstype),
          eq(schema.beschikbaarheidstypen.idwaarneemgroep, idwaarneemgroep),
          eq(schema.beschikbaarheidstypen.actief, true)
        )
      )
      .limit(1);
    if (!availabilityType?.id) {
      throw new PlannerRequestError('Het gekozen beschikbaarheidstype is niet beschikbaar.', 400);
    }
  }

  if (mutation.taskIds.length > 0) {
    const rows = await db
      .select({ id: schema.taaktypen.id })
      .from(schema.taaktypen)
      .where(
        and(
          eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep),
          inArray(schema.taaktypen.id, mutation.taskIds)
        )
      );
    if (rows.length !== mutation.taskIds.length) {
      throw new PlannerRequestError('Een of meer gekozen taken zijn niet beschikbaar.', 400);
    }
  }
}

async function loadSlots(
  idwaarneemgroep: number,
  start: string,
  end: string,
  iddeelnemer?: number
): Promise<PraktijkplannerPlanningSlot[]> {
  const conditions = [
    eq(schema.planning.idwaarneemgroep, idwaarneemgroep),
    gte(schema.planning.datum, start),
    lte(schema.planning.datum, end),
  ];
  if (iddeelnemer != null) conditions.push(eq(schema.planning.iddeelnemer, iddeelnemer));

  const rows = await db
    .select({
      id: schema.planning.id,
      iddeelnemer: schema.planning.iddeelnemer,
      datum: schema.planning.datum,
      iddagdeel: schema.planning.iddagdeel,
      idactiviteit: schema.planning.idactiviteit,
      idactiviteitspecificatie: schema.planning.idactiviteitspecificatie,
      idplannerlocatie: schema.planning.idplannerlocatie,
      version: schema.planning.version,
      activityId: schema.activiteiten.id,
      activityNaam: schema.activiteiten.naam,
      activityAfkorting: schema.activiteiten.afkorting,
      activityKleur: schema.activiteiten.kleur,
      activityIcon: schema.activiteiten.icon,
      specificationId: schema.activiteitSpecificaties.id,
      specificationNaam: schema.activiteitSpecificaties.naam,
      specificationAfkorting: schema.activiteitSpecificaties.afkorting,
      specificationKleur: schema.activiteitSpecificaties.kleur,
      locationId: schema.praktijkplannerlocaties.id,
      locationNaam: schema.praktijkplannerlocaties.naam,
      locationAfkorting: schema.praktijkplannerlocaties.afkorting,
      locationKleur: schema.praktijkplannerlocaties.kleur,
      availabilityId: schema.beschikbaarheidstypen.id,
      availabilityNaam: schema.beschikbaarheidstypen.naam,
      availabilityCode: schema.beschikbaarheidstypen.code,
      availabilityKleur: schema.beschikbaarheidstypen.kleur,
      availabilityIcon: schema.beschikbaarheidstypen.icon,
      recurrenceId: schema.planningherhalingslots.idherhaling,
      isBronslot: schema.planningherhalingslots.isBronslot,
      isUitzondering: schema.planningherhalingslots.isUitzondering,
      recurrenceSourceWeek: schema.planningherhalingen.bronstartdatum,
    })
    .from(schema.planning)
    .leftJoin(schema.activiteiten, eq(schema.planning.idactiviteit, schema.activiteiten.id))
    .leftJoin(
      schema.activiteitSpecificaties,
      eq(schema.planning.idactiviteitspecificatie, schema.activiteitSpecificaties.id)
    )
    .leftJoin(
      schema.praktijkplannerlocaties,
      eq(schema.planning.idplannerlocatie, schema.praktijkplannerlocaties.id)
    )
    .leftJoin(
      schema.planningbeschikbaarheid,
      eq(schema.planningbeschikbaarheid.idplanning, schema.planning.id)
    )
    .leftJoin(
      schema.beschikbaarheidstypen,
      eq(schema.planningbeschikbaarheid.idbeschikbaarheidstype, schema.beschikbaarheidstypen.id)
    )
    .leftJoin(
      schema.planningherhalingslots,
      eq(schema.planningherhalingslots.idplanning, schema.planning.id)
    )
    // Carries the week the pattern was copied from, so the warning on a changed slot can
    // name it instead of only stating that something deviates.
    .leftJoin(
      schema.planningherhalingen,
      eq(schema.planningherhalingen.id, schema.planningherhalingslots.idherhaling)
    )
    .where(and(...conditions))
    .orderBy(asc(schema.planning.datum), asc(schema.planning.iddagdeel), asc(schema.planning.iddeelnemer));

  const planningIds = rows
    .map((row) => row.id)
    .filter((id): id is number => id != null);
  const tasksByPlanning = new Map<number, PraktijkplannerPlanningSlot['tasks']>();

  if (planningIds.length > 0) {
    const taskRows = await db
      .select({
        idplanning: schema.planningtaak.idplanning,
        positie: schema.planningtaak.positie,
        id: schema.taaktypen.id,
        afkorting: schema.taaktypen.afkorting,
        omschrijving: schema.taaktypen.omschrijving,
        kleur: schema.taaktypen.kleur,
        inbelbaar: schema.taaktypen.inbelbaar,
      })
      .from(schema.planningtaak)
      .innerJoin(schema.taaktypen, eq(schema.planningtaak.idtaaktype, schema.taaktypen.id))
      .where(inArray(schema.planningtaak.idplanning, planningIds))
      .orderBy(asc(schema.planningtaak.positie));
    for (const task of taskRows) {
      if (task.idplanning == null || task.id == null || task.positie == null) continue;
      const items = tasksByPlanning.get(task.idplanning) ?? [];
      items.push({
        id: task.id,
        positie: task.positie,
        afkorting: task.afkorting,
        omschrijving: task.omschrijving,
        kleur: task.kleur,
        inbelbaar: task.inbelbaar === true,
      });
      tasksByPlanning.set(task.idplanning, items);
    }
  }

  return rows
    .filter(
      (
        row
      ): row is typeof row & {
        id: number;
        iddeelnemer: number;
        datum: string;
        iddagdeel: number;
        version: number;
      } =>
        row.id != null &&
        row.iddeelnemer != null &&
        row.datum != null &&
        row.iddagdeel != null &&
        row.version != null
    )
    .map((row) => ({
      id: row.id,
      iddeelnemer: row.iddeelnemer,
      datum: row.datum,
      iddagdeel: row.iddagdeel,
      idactiviteit: row.idactiviteit,
      idactiviteitspecificatie: row.idactiviteitspecificatie,
      idplannerlocatie: row.idplannerlocatie,
      version: row.version,
      activity:
        row.activityId != null && row.activityNaam != null
          ? {
              id: row.activityId,
              naam: row.activityNaam,
              afkorting: row.activityAfkorting,
              kleur: row.activityKleur,
              icon: row.activityIcon,
            }
          : null,
      specification:
        row.specificationId != null && row.specificationNaam != null
          ? {
              id: row.specificationId,
              naam: row.specificationNaam,
              afkorting: row.specificationAfkorting,
              kleur: row.specificationKleur,
            }
          : null,
      location:
        row.locationId != null && row.locationNaam != null
          ? {
              id: row.locationId,
              naam: row.locationNaam,
              afkorting: row.locationAfkorting,
              kleur: row.locationKleur,
            }
          : null,
      tasks: tasksByPlanning.get(row.id) ?? [],
      availability:
        row.availabilityId != null && row.availabilityNaam != null && row.availabilityCode != null
          ? {
              id: row.availabilityId,
              naam: row.availabilityNaam,
              code: row.availabilityCode,
              kleur: row.availabilityKleur,
              icon: row.availabilityIcon,
            }
          : null,
      recurrenceId: row.recurrenceId ?? null,
      isBronslot: row.recurrenceId != null ? Boolean(row.isBronslot) : null,
      isUitzondering: row.recurrenceId != null ? Boolean(row.isUitzondering) : null,
      recurrenceSourceWeek: row.recurrenceId != null ? (row.recurrenceSourceWeek ?? null) : null,
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const idwaarneemgroep = oneQueryValue(req.query.idwaarneemgroep);
    const accessResult = await resolvePraktijkplannerAccess(req, idwaarneemgroep, 'activiteiten:read');
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

    const start = oneQueryValue(req.query.start);
    const end = oneQueryValue(req.query.end);
    const participantId = parsePositiveInteger(oneQueryValue(req.query.iddeelnemer));
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
      return res.status(400).json({ error: 'Een geldig datumbereik is verplicht.' });
    }

    if (
      participantId != null &&
      !(await canAccessPraktijkplannerParticipant(accessResult.access, participantId))
    ) {
      return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
    }
    if (
      participantId != null &&
      !accessResult.access.isManager &&
      participantId !== accessResult.access.user.id
    ) {
      return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
    }

    try {
      return res
        .status(200)
        .json({
          slots: await loadSlots(
            accessResult.access.idwaarneemgroep,
            start,
            end,
            participantId ?? undefined
          ),
        });
    } catch (error) {
      console.error('[praktijkplanner/activiteiten GET]', error);
      return res.status(500).json({ error: 'De activiteitenplanning kon niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as { idwaarneemgroep?: unknown; slots?: unknown };
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'activiteiten:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);
  if (!Array.isArray(body.slots) || body.slots.length === 0 || body.slots.length > 200) {
    return res.status(400).json({ error: 'Voeg één tot maximaal 200 planningwijzigingen toe.' });
  }

  try {
    const parsed = body.slots.map((slot) => {
      const input = slot as SlotMutation;
      const iddeelnemer = parsePositiveInteger(input.iddeelnemer);
      const iddagdeel = parsePositiveInteger(input.iddagdeel);
      const idactiviteit = nullableId(input.idactiviteit);
      const idactiviteitspecificatie = nullableId(input.idactiviteitspecificatie);
      const idplannerlocatie = nullableId(input.idplannerlocatie);
      const idbeschikbaarheidstype = nullableId(input.idbeschikbaarheidstype);
      const taskIds = parseTaskIds(input.taskIds);
      const version =
        input.version == null || input.version === '' ? null : parsePositiveInteger(input.version);

      if (
        !iddeelnemer ||
        !iddagdeel ||
        !isIsoDate(input.datum) ||
        idactiviteit === undefined ||
        idactiviteitspecificatie === undefined ||
        idplannerlocatie === undefined ||
        idbeschikbaarheidstype === undefined ||
        taskIds == null ||
        (input.version != null && input.version !== '' && version == null)
      ) {
        throw new PlannerRequestError('Een planningwijziging bevat ongeldige gegevens.');
      }

      return {
        iddeelnemer,
        datum: input.datum,
        iddagdeel,
        idactiviteit,
        idactiviteitspecificatie,
        idplannerlocatie,
        idbeschikbaarheidstype,
        taskIds,
        version,
      };
    });

    const daypartIds = [...new Set(parsed.map((slot) => slot.iddagdeel))];
    const existingDayparts = await db
      .select({ id: schema.dagdelen.id })
      .from(schema.dagdelen)
      .where(inArray(schema.dagdelen.id, daypartIds));
    if (existingDayparts.length !== daypartIds.length) {
      throw new PlannerRequestError('Een gekozen dagdeel bestaat niet.');
    }

    for (const mutation of parsed) {
      if (!(await canAccessPraktijkplannerParticipant(accessResult.access, mutation.iddeelnemer, { requireManager: true }))) {
        throw new PlannerRequestError('Een deelnemer hoort niet bij deze waarneemgroep.', 403);
      }
      try {
        await assertDaypartSchedulable(
          accessResult.access.idwaarneemgroep,
          mutation.datum,
          mutation.iddagdeel,
          mutation.iddeelnemer
        );
      } catch (error) {
        if (error instanceof SchedulableDaypartError) {
          throw new PlannerRequestError(error.message, 400);
        }
        throw error;
      }
      await assertMasterDataBelongsToGroup(accessResult.access.idwaarneemgroep, mutation);
    }

    await db.transaction(async (tx) => {
      for (const mutation of parsed) {
        const [existing] = await tx
          .select({ id: schema.planning.id, version: schema.planning.version })
          .from(schema.planning)
          .where(
            and(
              eq(schema.planning.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.planning.iddeelnemer, mutation.iddeelnemer),
              eq(schema.planning.datum, mutation.datum),
              eq(schema.planning.iddagdeel, mutation.iddagdeel)
            )
          )
          .limit(1);

        if (existing?.id != null && mutation.version != null && existing.version !== mutation.version) {
          throw new PlannerRequestError(
            'Deze planning is ondertussen gewijzigd. Vernieuw de pagina en probeer opnieuw.',
            409
          );
        }

        const isEmpty =
          mutation.idactiviteit == null &&
          mutation.idactiviteitspecificatie == null &&
          mutation.idplannerlocatie == null &&
          mutation.idbeschikbaarheidstype == null &&
          mutation.taskIds.length === 0;

        if (isEmpty) {
          if (existing?.id != null) {
            const [link] = await tx
              .select({
                idherhaling: schema.planningherhalingslots.idherhaling,
                isBronslot: schema.planningherhalingslots.isBronslot,
              })
              .from(schema.planningherhalingslots)
              .where(eq(schema.planningherhalingslots.idplanning, existing.id))
              .limit(1);
            if (link?.idherhaling != null && !link.isBronslot) {
              await tx
                .insert(schema.planningherhalinguitzonderingen)
                .values({
                  idherhaling: link.idherhaling,
                  reeksdatum: mutation.datum,
                  iddagdeel: mutation.iddagdeel,
                  type: 'verwijderd',
                  createdBy: accessResult.access.user.id,
                })
                .onConflictDoNothing();
            }
            await tx.delete(schema.planning).where(eq(schema.planning.id, existing.id));
          }
          continue;
        }

        let planningId: number;
        if (existing?.id != null) {
          await tx
            .update(schema.planning)
            .set({
              idactiviteit: mutation.idactiviteit,
              idactiviteitspecificatie: mutation.idactiviteitspecificatie,
              idplannerlocatie: mutation.idplannerlocatie,
              updatedBy: accessResult.access.user.id,
            })
            .where(eq(schema.planning.id, existing.id));
          planningId = existing.id;
          const [link] = await tx
            .select({
              idherhaling: schema.planningherhalingslots.idherhaling,
              isBronslot: schema.planningherhalingslots.isBronslot,
              isUitzondering: schema.planningherhalingslots.isUitzondering,
            })
            .from(schema.planningherhalingslots)
            .where(eq(schema.planningherhalingslots.idplanning, existing.id))
            .limit(1);
          if (link?.idherhaling != null && !link.isBronslot && !link.isUitzondering) {
            await tx
              .update(schema.planningherhalingslots)
              .set({
                isUitzondering: true,
                uitzonderingAt: new Date().toISOString(),
              })
              .where(eq(schema.planningherhalingslots.idplanning, existing.id));
          }
        } else {
          const [created] = await tx
            .insert(schema.planning)
            .values({
              idwaarneemgroep: accessResult.access.idwaarneemgroep,
              iddeelnemer: mutation.iddeelnemer,
              datum: mutation.datum,
              iddagdeel: mutation.iddagdeel,
              idactiviteit: mutation.idactiviteit,
              idactiviteitspecificatie: mutation.idactiviteitspecificatie,
              idplannerlocatie: mutation.idplannerlocatie,
              createdBy: accessResult.access.user.id,
              updatedBy: accessResult.access.user.id,
            })
            .returning({ id: schema.planning.id });
          if (!created?.id) throw new PlannerRequestError('Planning kon niet worden aangemaakt.', 500);
          planningId = created.id;
        }

        await tx.delete(schema.planningtaak).where(eq(schema.planningtaak.idplanning, planningId));
        if (mutation.taskIds.length > 0) {
          await tx.insert(schema.planningtaak).values(
            mutation.taskIds.map((idtaaktype, index) => ({
              idplanning: planningId,
              idtaaktype,
              positie: index + 1,
            }))
          );
        }

        await tx
          .delete(schema.planningbeschikbaarheid)
          .where(eq(schema.planningbeschikbaarheid.idplanning, planningId));
        if (mutation.idbeschikbaarheidstype != null) {
          await tx.insert(schema.planningbeschikbaarheid).values({
            idplanning: planningId,
            idbeschikbaarheidstype: mutation.idbeschikbaarheidstype,
            updatedBy: accessResult.access.user.id,
          });
        }
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof PlannerRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[praktijkplanner/activiteiten POST]', error);
    return res.status(500).json({ error: 'De activiteitenplanning kon niet worden opgeslagen.' });
  }
}
