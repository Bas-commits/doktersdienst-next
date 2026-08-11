import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { parseNonNegativeInteger, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import { isDaypartSchedulable } from '@/lib/praktijkplanner/schedulable-dayparts';
import { loadSchedulableDayparts } from '@/lib/praktijkplanner/schedulable-dayparts-db';
import type { PraktijkplannerCapacityCell } from '@/types/praktijkplanner';

type Data = { cells: PraktijkplannerCapacityCell[] } | { success: true } | { error: string };

type CellMutation = {
  weekdag: unknown;
  iddagdeel: unknown;
  aantalDeelnemers: unknown;
  expertises?: unknown;
  tasks?: unknown;
  activities?: unknown;
  specifications?: unknown;
};

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRequirements(value: unknown): Array<{ id: number; aantal: number }> | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  const result: Array<{ id: number; aantal: number }> = [];
  const ids = new Set<number>();
  for (const item of value) {
    const row = item as Record<string, unknown>;
    const id = parsePositiveInteger(row.id);
    const aantal = parseNonNegativeInteger(row.aantal);
    if (!id || aantal == null || ids.has(id)) return null;
    ids.add(id);
    result.push({ id, aantal });
  }
  return result;
}

/**
 * Het sjabloon van een regime, of dat van de normale week als er geen regime is gekozen.
 *
 * De normale week is de rij met idregime leeg. Dat moet met IS NULL, niet met een vergelijking:
 * `= NULL` levert in SQL geen enkele rij op en het scherm zou dan leeg blijven.
 */
function regimeFilter(idregime: number | null) {
  return idregime == null
    ? isNull(schema.capaciteitsjablonen.idregime)
    : eq(schema.capaciteitsjablonen.idregime, idregime);
}

async function regimeInGroup(idregime: number, idwaarneemgroep: number) {
  const [regime] = await db
    .select({ id: schema.capaciteitsregimes.id })
    .from(schema.capaciteitsregimes)
    .where(
      and(
        eq(schema.capaciteitsregimes.id, idregime),
        eq(schema.capaciteitsregimes.idwaarneemgroep, idwaarneemgroep)
      )
    )
    .limit(1);
  return regime?.id != null;
}

async function locationInGroup(idplannerlocatie: number, idwaarneemgroep: number) {
  const [location] = await db
    .select({ id: schema.praktijkplannerlocaties.id })
    .from(schema.praktijkplannerlocaties)
    .where(
      and(
        eq(schema.praktijkplannerlocaties.id, idplannerlocatie),
        eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep),
        eq(schema.praktijkplannerlocaties.actief, true)
      )
    )
    .limit(1);
  return location?.id != null;
}

async function assertRequirementIds(input: {
  idwaarneemgroep: number;
  expertises: number[];
  tasks: number[];
  activities: number[];
  specifications: number[];
}) {
  const [expertises, tasks, activities, specifications] = await Promise.all([
    input.expertises.length
      ? db
          .select({ id: schema.expertises.id })
          .from(schema.expertises)
          .where(
            and(
              eq(schema.expertises.idwaarneemgroep, input.idwaarneemgroep),
              inArray(schema.expertises.id, input.expertises)
            )
          )
      : Promise.resolve([]),
    input.tasks.length
      ? db
          .select({ id: schema.taaktypen.id })
          .from(schema.taaktypen)
          .where(
            and(
              eq(schema.taaktypen.idwaarneemgroep, input.idwaarneemgroep),
              inArray(schema.taaktypen.id, input.tasks)
            )
          )
      : Promise.resolve([]),
    input.activities.length
      ? db
          .select({ id: schema.activiteiten.id })
          .from(schema.activiteiten)
          .where(
            and(
              eq(schema.activiteiten.idwaarneemgroep, input.idwaarneemgroep),
              inArray(schema.activiteiten.id, input.activities)
            )
          )
      : Promise.resolve([]),
    input.specifications.length
      ? db
          .select({ id: schema.activiteitSpecificaties.id })
          .from(schema.activiteitSpecificaties)
          .innerJoin(
            schema.activiteiten,
            eq(schema.activiteitSpecificaties.idactiviteit, schema.activiteiten.id)
          )
          .where(
            and(
              eq(schema.activiteiten.idwaarneemgroep, input.idwaarneemgroep),
              inArray(schema.activiteitSpecificaties.id, input.specifications)
            )
          )
      : Promise.resolve([]),
  ]);

  if (
    expertises.length !== input.expertises.length ||
    tasks.length !== input.tasks.length ||
    activities.length !== input.activities.length ||
    specifications.length !== input.specifications.length
  ) {
    throw new Error('invalid-requirement');
  }
}

async function loadCapacity(
  idwaarneemgroep: number,
  idplannerlocatie: number,
  idregime: number | null
): Promise<PraktijkplannerCapacityCell[]> {
  const templates = await db
    .select({
      id: schema.capaciteitsjablonen.id,
      weekdag: schema.capaciteitsjablonen.weekdag,
      iddagdeel: schema.capaciteitsjablonen.iddagdeel,
      aantalDeelnemers: schema.capaciteitsjablonen.aantalDeelnemers,
    })
    .from(schema.capaciteitsjablonen)
    .where(
      and(
        eq(schema.capaciteitsjablonen.idwaarneemgroep, idwaarneemgroep),
        eq(schema.capaciteitsjablonen.idplannerlocatie, idplannerlocatie),
        regimeFilter(idregime)
      )
    );
  const ids = templates.map((template) => template.id).filter((id): id is number => id != null);
  if (ids.length === 0) return [];

  const [expertises, tasks, activities, specifications] = await Promise.all([
    db
      .select({
        idcapaciteitsjabloon: schema.capaciteitsjabloonexpertises.idcapaciteitsjabloon,
        id: schema.capaciteitsjabloonexpertises.idexpertise,
        aantal: schema.capaciteitsjabloonexpertises.aantal,
      })
      .from(schema.capaciteitsjabloonexpertises)
      .where(inArray(schema.capaciteitsjabloonexpertises.idcapaciteitsjabloon, ids)),
    db
      .select({
        idcapaciteitsjabloon: schema.capaciteitsjabloontaken.idcapaciteitsjabloon,
        id: schema.capaciteitsjabloontaken.idtaaktype,
        aantal: schema.capaciteitsjabloontaken.aantal,
      })
      .from(schema.capaciteitsjabloontaken)
      .where(inArray(schema.capaciteitsjabloontaken.idcapaciteitsjabloon, ids)),
    db
      .select({
        idcapaciteitsjabloon: schema.capaciteitsjabloonactiviteiten.idcapaciteitsjabloon,
        id: schema.capaciteitsjabloonactiviteiten.idactiviteit,
        aantal: schema.capaciteitsjabloonactiviteiten.aantal,
      })
      .from(schema.capaciteitsjabloonactiviteiten)
      .where(inArray(schema.capaciteitsjabloonactiviteiten.idcapaciteitsjabloon, ids)),
    db
      .select({
        idcapaciteitsjabloon: schema.capaciteitsjabloonspecificaties.idcapaciteitsjabloon,
        id: schema.capaciteitsjabloonspecificaties.idactiviteitspecificatie,
        aantal: schema.capaciteitsjabloonspecificaties.aantal,
      })
      .from(schema.capaciteitsjabloonspecificaties)
      .where(inArray(schema.capaciteitsjabloonspecificaties.idcapaciteitsjabloon, ids)),
  ]);

  const valuesByTemplate = <T extends { idcapaciteitsjabloon: number | null; id: number | null; aantal: number | null }>(
    rows: T[]
  ) => {
    const map = new Map<number, Array<{ id: number; aantal: number }>>();
    for (const row of rows) {
      if (row.idcapaciteitsjabloon == null || row.id == null || row.aantal == null) continue;
      const current = map.get(row.idcapaciteitsjabloon) ?? [];
      current.push({ id: row.id, aantal: row.aantal });
      map.set(row.idcapaciteitsjabloon, current);
    }
    return map;
  };

  const expertiseMap = valuesByTemplate(expertises);
  const taskMap = valuesByTemplate(tasks);
  const activityMap = valuesByTemplate(activities);
  const specificationMap = valuesByTemplate(specifications);

  return templates
    .filter(
      (
        template
      ): template is typeof template & {
        id: number;
        weekdag: number;
        iddagdeel: number;
        aantalDeelnemers: number;
      } =>
        template.id != null &&
        template.weekdag != null &&
        template.iddagdeel != null &&
        template.aantalDeelnemers != null
    )
    .map((template) => ({
      id: template.id,
      weekdag: template.weekdag,
      iddagdeel: template.iddagdeel,
      aantalDeelnemers: template.aantalDeelnemers,
      expertises: expertiseMap.get(template.id) ?? [],
      tasks: taskMap.get(template.id) ?? [],
      activities: activityMap.get(template.id) ?? [],
      specifications: specificationMap.get(template.id) ?? [],
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      oneQueryValue(req.query.idwaarneemgroep),
      'capaciteit:read'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);
    const idplannerlocatie = parsePositiveInteger(oneQueryValue(req.query.idplannerlocatie));
    if (!idplannerlocatie || !(await locationInGroup(idplannerlocatie, accessResult.access.idwaarneemgroep))) {
      return res.status(400).json({ error: 'Kies een geldige plannerlocatie.' });
    }
    const gevraagdRegime = oneQueryValue(req.query.idregime);
    let idregime: number | null = null;
    if (gevraagdRegime !== undefined && gevraagdRegime !== '') {
      idregime = parsePositiveInteger(gevraagdRegime);
      if (!idregime || !(await regimeInGroup(idregime, accessResult.access.idwaarneemgroep))) {
        return res.status(400).json({ error: 'Dit regime bestaat niet.' });
      }
    }
    try {
      return res.status(200).json({
        cells: await loadCapacity(accessResult.access.idwaarneemgroep, idplannerlocatie, idregime),
      });
    } catch (error) {
      console.error('[praktijkplanner/capaciteit GET]', error);
      return res.status(500).json({ error: 'De capaciteitsplanning kon niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'capaciteit:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const idplannerlocatie = parsePositiveInteger(body.idplannerlocatie);
  if (!idplannerlocatie || !(await locationInGroup(idplannerlocatie, accessResult.access.idwaarneemgroep))) {
    return res.status(400).json({ error: 'Kies een geldige plannerlocatie.' });
  }
  if (!Array.isArray(body.cells) || body.cells.length > 28) {
    return res.status(400).json({ error: 'De capaciteit bevat maximaal 28 dagdelen.' });
  }
  let idregime: number | null = null;
  if (body.idregime != null) {
    idregime = parsePositiveInteger(body.idregime);
    if (!idregime || !(await regimeInGroup(idregime, accessResult.access.idwaarneemgroep))) {
      return res.status(400).json({ error: 'Dit regime bestaat niet.' });
    }
  }

  try {
    const cells = body.cells.map((raw) => {
      const input = raw as CellMutation;
      const weekdag = Number(input.weekdag);
      const iddagdeel = parsePositiveInteger(input.iddagdeel);
      const aantalDeelnemers = parseNonNegativeInteger(input.aantalDeelnemers);
      const expertises = parseRequirements(input.expertises);
      const tasks = parseRequirements(input.tasks);
      const activities = parseRequirements(input.activities);
      const specifications = parseRequirements(input.specifications);
      if (
        !Number.isInteger(weekdag) ||
        weekdag < 1 ||
        weekdag > 7 ||
        !iddagdeel ||
        aantalDeelnemers == null ||
        !expertises ||
        !tasks ||
        !activities ||
        !specifications
      ) {
        throw new Error('invalid-cell');
      }
      return { weekdag, iddagdeel, aantalDeelnemers, expertises, tasks, activities, specifications };
    });
    const identifiers = new Set(cells.map((cell) => `${cell.weekdag}:${cell.iddagdeel}`));
    if (identifiers.size !== cells.length) return res.status(400).json({ error: 'Een dagdeel komt dubbel voor.' });

    const daypartIds = [...new Set(cells.map((cell) => cell.iddagdeel))];
    const [dayparts] = await Promise.all([
      db
        .select({ id: schema.dagdelen.id })
        .from(schema.dagdelen)
        .where(inArray(schema.dagdelen.id, daypartIds)),
      assertRequirementIds({
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        expertises: [...new Set(cells.flatMap((cell) => cell.expertises.map((item) => item.id)))],
        tasks: [...new Set(cells.flatMap((cell) => cell.tasks.map((item) => item.id)))],
        activities: [...new Set(cells.flatMap((cell) => cell.activities.map((item) => item.id)))],
        specifications: [...new Set(cells.flatMap((cell) => cell.specifications.map((item) => item.id)))],
      }),
    ]);
    if (dayparts.length !== daypartIds.length) {
      return res.status(400).json({ error: 'Een gekozen dagdeel bestaat niet.' });
    }

    const schedulableMatrix = await loadSchedulableDayparts(accessResult.access.idwaarneemgroep);
    const schedulableCells = cells.filter((cell) =>
      isDaypartSchedulable(schedulableMatrix, cell.weekdag, cell.iddagdeel)
    );
    for (const cell of cells) {
      if (isDaypartSchedulable(schedulableMatrix, cell.weekdag, cell.iddagdeel)) continue;
      const hasContent =
        cell.aantalDeelnemers > 0 ||
        cell.expertises.some((item) => item.aantal > 0) ||
        cell.tasks.some((item) => item.aantal > 0) ||
        cell.activities.some((item) => item.aantal > 0) ||
        cell.specifications.some((item) => item.aantal > 0);
      if (hasContent) {
        return res.status(400).json({
          error: 'Dit dagdeel is niet inplanbaar voor deze weekdag.',
        });
      }
    }

    const cellByKey = new Map(schedulableCells.map((cell) => [`${cell.weekdag}:${cell.iddagdeel}`, cell]));
    const updatedAt = new Date().toISOString();
    const updatedBy = accessResult.access.user.id;

    await db.transaction(async (tx) => {
      // One upsert for the whole week×daypart matrix instead of per-cell select/update.
      if (schedulableCells.length === 0) {
        return;
      }
      const upserted = await tx
        .insert(schema.capaciteitsjablonen)
        .values(
          schedulableCells.map((cell) => ({
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            idplannerlocatie,
            weekdag: cell.weekdag,
            iddagdeel: cell.iddagdeel,
            idregime,
            aantalDeelnemers: cell.aantalDeelnemers,
            updatedBy,
            updatedAt,
          }))
        )
        .onConflictDoUpdate({
          target: [
            schema.capaciteitsjablonen.idwaarneemgroep,
            schema.capaciteitsjablonen.idplannerlocatie,
            schema.capaciteitsjablonen.weekdag,
            schema.capaciteitsjablonen.iddagdeel,
            schema.capaciteitsjablonen.idregime,
          ],
          set: {
            aantalDeelnemers: sql`excluded.aantal_deelnemers`,
            updatedBy,
            updatedAt,
          },
        })
        .returning({
          id: schema.capaciteitsjablonen.id,
          weekdag: schema.capaciteitsjablonen.weekdag,
          iddagdeel: schema.capaciteitsjablonen.iddagdeel,
        });

      const templateIds = upserted
        .map((row) => row.id)
        .filter((id): id is number => id != null);
      if (templateIds.length !== schedulableCells.length) throw new Error('template-create-failed');

      await Promise.all([
        tx
          .delete(schema.capaciteitsjabloonexpertises)
          .where(inArray(schema.capaciteitsjabloonexpertises.idcapaciteitsjabloon, templateIds)),
        tx
          .delete(schema.capaciteitsjabloontaken)
          .where(inArray(schema.capaciteitsjabloontaken.idcapaciteitsjabloon, templateIds)),
        tx
          .delete(schema.capaciteitsjabloonactiviteiten)
          .where(inArray(schema.capaciteitsjabloonactiviteiten.idcapaciteitsjabloon, templateIds)),
        tx
          .delete(schema.capaciteitsjabloonspecificaties)
          .where(inArray(schema.capaciteitsjabloonspecificaties.idcapaciteitsjabloon, templateIds)),
      ]);

      const expertiseRows: Array<{ idcapaciteitsjabloon: number; idexpertise: number; aantal: number }> = [];
      const taskRows: Array<{ idcapaciteitsjabloon: number; idtaaktype: number; aantal: number }> = [];
      const activityRows: Array<{ idcapaciteitsjabloon: number; idactiviteit: number; aantal: number }> = [];
      const specificationRows: Array<{
        idcapaciteitsjabloon: number;
        idactiviteitspecificatie: number;
        aantal: number;
      }> = [];

      for (const row of upserted) {
        if (row.id == null || row.weekdag == null || row.iddagdeel == null) continue;
        const cell = cellByKey.get(`${row.weekdag}:${row.iddagdeel}`);
        if (!cell) continue;
        for (const item of cell.expertises) {
          expertiseRows.push({ idcapaciteitsjabloon: row.id, idexpertise: item.id, aantal: item.aantal });
        }
        for (const item of cell.tasks) {
          taskRows.push({ idcapaciteitsjabloon: row.id, idtaaktype: item.id, aantal: item.aantal });
        }
        for (const item of cell.activities) {
          activityRows.push({ idcapaciteitsjabloon: row.id, idactiviteit: item.id, aantal: item.aantal });
        }
        for (const item of cell.specifications) {
          specificationRows.push({
            idcapaciteitsjabloon: row.id,
            idactiviteitspecificatie: item.id,
            aantal: item.aantal,
          });
        }
      }

      await Promise.all([
        expertiseRows.length
          ? tx.insert(schema.capaciteitsjabloonexpertises).values(expertiseRows)
          : Promise.resolve(),
        taskRows.length ? tx.insert(schema.capaciteitsjabloontaken).values(taskRows) : Promise.resolve(),
        activityRows.length
          ? tx.insert(schema.capaciteitsjabloonactiviteiten).values(activityRows)
          : Promise.resolve(),
        specificationRows.length
          ? tx.insert(schema.capaciteitsjabloonspecificaties).values(specificationRows)
          : Promise.resolve(),
      ]);
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid-requirement') {
      return res.status(400).json({ error: 'Een capaciteitseis hoort niet bij deze waarneemgroep.' });
    }
    if (error instanceof Error && error.message === 'invalid-cell') {
      return res.status(400).json({ error: 'Een capaciteitcel bevat ongeldige waarden.' });
    }
    console.error('[praktijkplanner/capaciteit POST]', error);
    return res.status(500).json({ error: 'De capaciteitsplanning kon niet worden opgeslagen.' });
  }
}
