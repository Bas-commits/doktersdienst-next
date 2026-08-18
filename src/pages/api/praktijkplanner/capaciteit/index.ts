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
import { dienstTaaktypeIds } from '@/lib/praktijkplanner/dienst-taaktypen';
import type { PraktijkplannerCapacityCell } from '@/types/praktijkplanner';

type Data =
  | { cells: PraktijkplannerCapacityCell[]; groepCells: PraktijkplannerCapacityCell[] }
  | { success: true }
  | { error: string };

type CellMutation = {
  weekdag: unknown;
  iddagdeel: unknown;
  aantalDeelnemers: unknown;
  expertises?: unknown;
  tasks?: unknown;
  activities?: unknown;
  specifications?: unknown;
};

type Requirement = { id: number; aantal: number };

type ParsedCell = {
  weekdag: number;
  iddagdeel: number;
  aantalDeelnemers: number;
  expertises: Requirement[];
  tasks: Requirement[];
  activities: Requirement[];
  specifications: Requirement[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type SaveOptions = {
  idwaarneemgroep: number;
  /** Leeg is de eis voor de hele waarneemgroep. */
  idplannerlocatie: number | null;
  idregime: number | null;
  cells: ParsedCell[];
  updatedBy: number;
  updatedAt: string;
};

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Gooit `invalid-cell` zodat de handler er een 400 met een leesbare reden van maakt. */
function parseCells(raw: unknown): ParsedCell[] {
  if (!Array.isArray(raw)) throw new Error('invalid-cell');
  return raw.map((item) => {
    const input = item as CellMutation;
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

/** Idem voor de locatie: leeg is de eis die voor de hele waarneemgroep geldt. */
function locatieFilter(idplannerlocatie: number | null) {
  return idplannerlocatie == null
    ? isNull(schema.capaciteitsjablonen.idplannerlocatie)
    : eq(schema.capaciteitsjablonen.idplannerlocatie, idplannerlocatie);
}

/**
 * De taken die op elke locatie mogen gebeuren, als set met hun ids.
 *
 * Waar een eis hoort volgt uit het taaktype, dus de server hoeft het scherm niet te geloven:
 * een locatiegebonden taak in het groepsblok en andersom worden allebei geweigerd.
 */
async function nietLocatieGebondenTaken(idwaarneemgroep: number): Promise<Set<number>> {
  const rows = await db
    .select({ id: schema.taaktypen.id, niet: schema.taaktypen.nietLocatieGebonden })
    .from(schema.taaktypen)
    .where(eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep));
  return new Set(
    rows.filter((row) => row.niet === true && row.id != null).map((row) => row.id as number)
  );
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
  idplannerlocatie: number | null,
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
        locatieFilter(idplannerlocatie),
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
      const [cells, groepCells] = await Promise.all([
        loadCapacity(accessResult.access.idwaarneemgroep, idplannerlocatie, idregime),
        loadCapacity(accessResult.access.idwaarneemgroep, null, idregime),
      ]);
      return res.status(200).json({ cells, groepCells });
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

  if (body.groepCells !== undefined && (!Array.isArray(body.groepCells) || body.groepCells.length > 28)) {
    return res.status(400).json({ error: 'De capaciteit bevat maximaal 28 dagdelen.' });
  }

  try {
    const cells = parseCells(body.cells);
    const groepCells = body.groepCells === undefined ? null : parseCells(body.groepCells);
    const alleCellen = groepCells ? [...cells, ...groepCells] : cells;

    for (const set of [cells, groepCells ?? []]) {
      const identifiers = new Set(set.map((cell) => `${cell.weekdag}:${cell.iddagdeel}`));
      if (identifiers.size !== set.length) {
        return res.status(400).json({ error: 'Een dagdeel komt dubbel voor.' });
      }
    }

    const daypartIds = [...new Set(alleCellen.map((cell) => cell.iddagdeel))];
    const [dayparts] = await Promise.all([
      db
        .select({ id: schema.dagdelen.id })
        .from(schema.dagdelen)
        .where(inArray(schema.dagdelen.id, daypartIds)),
      assertRequirementIds({
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        expertises: [...new Set(alleCellen.flatMap((cell) => cell.expertises.map((item) => item.id)))],
        tasks: [...new Set(alleCellen.flatMap((cell) => cell.tasks.map((item) => item.id)))],
        activities: [...new Set(alleCellen.flatMap((cell) => cell.activities.map((item) => item.id)))],
        specifications: [...new Set(alleCellen.flatMap((cell) => cell.specifications.map((item) => item.id)))],
      }),
    ]);
    if (dayparts.length !== daypartIds.length) {
      return res.status(400).json({ error: 'Een gekozen dagdeel bestaat niet.' });
    }

    // Waar een taak-eis hoort volgt uit het taaktype. De server controleert dat zelf, zodat een
    // oude tab of een tweede scherm dezelfde eis niet op twee plekken kan zetten.
    const overalToegestaan = await nietLocatieGebondenTaken(accessResult.access.idwaarneemgroep);
    for (const cell of cells) {
      if (cell.tasks.some((item) => overalToegestaan.has(item.id))) {
        return res.status(400).json({
          error: 'Een taak die op elke locatie mag gebeuren hoort bij de eis voor de hele groep.',
        });
      }
    }
    for (const cell of groepCells ?? []) {
      if (cell.tasks.some((item) => !overalToegestaan.has(item.id))) {
        return res.status(400).json({
          error: 'Deze taak is locatiegebonden en hoort bij een locatie.',
        });
      }
      // De groepsrij draagt alleen taken. Een aantal dokters of een expertise zou daar een
      // tweede, onzichtbare eis worden naast die van de locaties.
      const anders =
        cell.aantalDeelnemers > 0 ||
        cell.expertises.some((item) => item.aantal > 0) ||
        cell.activities.some((item) => item.aantal > 0) ||
        cell.specifications.some((item) => item.aantal > 0);
      if (anders) {
        return res.status(400).json({
          error: 'Voor de hele groep kunnen alleen taken worden opgegeven.',
        });
      }
    }

    /*
      Op een dagdeel dat de groep heeft uitgezet mag alleen een dienst staan. Dat is dezelfde
      uitzondering als in de Activiteiten planner, en zonder de eis erbij zou nergens te zien
      zijn dat er 's nachts iemand nodig is. Al het andere blijft daar geweigerd.
    */
    const schedulableMatrix = await loadSchedulableDayparts(accessResult.access.idwaarneemgroep);
    const diensten = await dienstTaaktypeIds(accessResult.access.idwaarneemgroep);
    for (const cell of alleCellen) {
      if (isDaypartSchedulable(schedulableMatrix, cell.weekdag, cell.iddagdeel)) continue;
      const anders =
        cell.aantalDeelnemers > 0 ||
        cell.expertises.some((item) => item.aantal > 0) ||
        cell.tasks.some((item) => item.aantal > 0 && !diensten.has(item.id)) ||
        cell.activities.some((item) => item.aantal > 0) ||
        cell.specifications.some((item) => item.aantal > 0);
      if (anders) {
        return res.status(400).json({
          error: 'Dit dagdeel is niet inplanbaar voor deze weekdag; alleen een dienst mag hier.',
        });
      }
    }
    const updatedAt = new Date().toISOString();
    const updatedBy = accessResult.access.user.id;

    await db.transaction(async (tx) => {
      await bewaarCellen(tx, {
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        idplannerlocatie,
        idregime,
        cells,
        updatedBy,
        updatedAt,
      });
      if (groepCells) {
        await bewaarCellen(tx, {
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          idplannerlocatie: null,
          idregime,
          cells: groepCells,
          updatedBy,
          updatedAt,
        });
      }
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

/**
 * Zet een hele week aan eisen neer voor een locatie, of voor de groep als de locatie leeg is.
 *
 * De weekdag maal dagdeel matrix gaat in een upsert in plaats van per cel een select en een
 * update, en de eisen eronder worden weggegooid en opnieuw gezet: het scherm stuurt altijd de
 * volledige stand.
 */
async function bewaarCellen(tx: Tx, options: SaveOptions) {
  const { idwaarneemgroep, idplannerlocatie, idregime, cells: schedulableCells, updatedBy, updatedAt } = options;
  const cellByKey = new Map(schedulableCells.map((cell) => [`${cell.weekdag}:${cell.iddagdeel}`, cell]));
  {
    {
      if (schedulableCells.length === 0) {
        return;
      }
      const upserted = await tx
        .insert(schema.capaciteitsjablonen)
        .values(
          schedulableCells.map((cell) => ({
            idwaarneemgroep,
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
    }
  }
}
