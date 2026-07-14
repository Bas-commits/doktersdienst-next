import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger, weekdayFromIsoDate } from '@/lib/praktijkplanner/dates';

type ReportRow = {
  id: string;
  soort: 'activiteit' | 'specificatie' | 'taak';
  label: string;
  kleur: string | null;
  cellen: Record<string, number>;
  totaal: number;
};

type Data = { rows: ReportRow[] } | { error: string };

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function addCount(
  rows: Map<string, ReportRow>,
  input: Omit<ReportRow, 'cellen' | 'totaal'>,
  cell: string
) {
  const existing = rows.get(input.id) ?? { ...input, cellen: {}, totaal: 0 };
  existing.cellen[cell] = (existing.cellen[cell] ?? 0) + 1;
  existing.totaal += 1;
  rows.set(input.id, existing);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessResult = await resolvePraktijkplannerAccess(
    req,
    oneQueryValue(req.query.idwaarneemgroep),
    'dokter-activiteiten:read'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const iddeelnemer = parsePositiveInteger(oneQueryValue(req.query.iddeelnemer));
  const start = oneQueryValue(req.query.start);
  const end = oneQueryValue(req.query.end);
  if (!iddeelnemer || !isIsoDate(start) || !isIsoDate(end) || start > end) {
    return res.status(400).json({ error: 'Een geldige deelnemer en datumbereik zijn verplicht.' });
  }
  if (!(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer))) {
    return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
  }

  try {
    const rows = await db
      .select({
        id: schema.planning.id,
        datum: schema.planning.datum,
        iddagdeel: schema.planning.iddagdeel,
        activityId: schema.activiteiten.id,
        activityNaam: schema.activiteiten.naam,
        activityAfkorting: schema.activiteiten.afkorting,
        activityKleur: schema.activiteiten.kleur,
        specificationId: schema.activiteitSpecificaties.id,
        specificationNaam: schema.activiteitSpecificaties.naam,
        specificationAfkorting: schema.activiteitSpecificaties.afkorting,
        specificationKleur: schema.activiteitSpecificaties.kleur,
      })
      .from(schema.planning)
      .leftJoin(schema.activiteiten, eq(schema.planning.idactiviteit, schema.activiteiten.id))
      .leftJoin(
        schema.activiteitSpecificaties,
        eq(schema.planning.idactiviteitspecificatie, schema.activiteitSpecificaties.id)
      )
      .where(
        and(
          eq(schema.planning.idwaarneemgroep, accessResult.access.idwaarneemgroep),
          eq(schema.planning.iddeelnemer, iddeelnemer),
          gte(schema.planning.datum, start),
          lte(schema.planning.datum, end)
        )
      );

    const planningIds = rows.map((row) => row.id).filter((id): id is number => id != null);
    const [taskRows, absenceRows] = await Promise.all([
      planningIds.length > 0
        ? db
            .select({
              idplanning: schema.planningtaak.idplanning,
              idtaaktype: schema.planningtaak.idtaaktype,
              afkorting: schema.taaktypen.afkorting,
              omschrijving: schema.taaktypen.omschrijving,
              kleur: schema.taaktypen.kleur,
            })
            .from(schema.planningtaak)
            .innerJoin(schema.taaktypen, eq(schema.planningtaak.idtaaktype, schema.taaktypen.id))
            .where(inArray(schema.planningtaak.idplanning, planningIds))
        : Promise.resolve([]),
      db
        .select({
          datum: schema.planningafwezigheden.datum,
          iddagdeel: schema.planningafwezigheden.iddagdeel,
        })
        .from(schema.planningafwezigheden)
        .where(
          and(
            eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            eq(schema.planningafwezigheden.iddeelnemer, iddeelnemer),
            gte(schema.planningafwezigheden.datum, start),
            lte(schema.planningafwezigheden.datum, end)
          )
        ),
    ]);

    const absenceKeys = new Set(
      absenceRows
        .filter((row) => row.datum != null && row.iddagdeel != null)
        .map((row) => `${row.datum}:${row.iddagdeel}`)
    );
    const tasksByPlanning = new Map<number, typeof taskRows>();
    for (const task of taskRows) {
      if (task.idplanning == null) continue;
      const list = tasksByPlanning.get(task.idplanning) ?? [];
      list.push(task);
      tasksByPlanning.set(task.idplanning, list);
    }

    const aggregate = new Map<string, ReportRow>();
    for (const row of rows) {
      if (row.id == null || row.datum == null || row.iddagdeel == null) continue;
      if (absenceKeys.has(`${row.datum}:${row.iddagdeel}`)) continue;
      const cell = `${weekdayFromIsoDate(row.datum)}:${row.iddagdeel}`;

      if (row.activityId != null && row.activityNaam != null) {
        addCount(
          aggregate,
          {
            id: `activiteit:${row.activityId}`,
            soort: 'activiteit',
            label: row.activityAfkorting || row.activityNaam,
            kleur: row.activityKleur,
          },
          cell
        );
      }
      if (row.specificationId != null && row.specificationNaam != null) {
        addCount(
          aggregate,
          {
            id: `specificatie:${row.specificationId}`,
            soort: 'specificatie',
            label: row.specificationAfkorting || row.specificationNaam,
            kleur: row.specificationKleur,
          },
          cell
        );
      }
      for (const task of tasksByPlanning.get(row.id) ?? []) {
        if (task.idtaaktype == null) continue;
        addCount(
          aggregate,
          {
            id: `taak:${task.idtaaktype}`,
            soort: 'taak',
            label: task.afkorting || task.omschrijving || `Taak ${task.idtaaktype}`,
            kleur: task.kleur,
          },
          cell
        );
      }
    }

    return res.status(200).json({
      rows: [...aggregate.values()].sort((a, b) => a.label.localeCompare(b.label, 'nl')),
    });
  } catch (error) {
    console.error('[praktijkplanner/rapportages/activiteiten]', error);
    return res.status(500).json({ error: 'De activiteitentelling kon niet worden geladen.' });
  }
}
