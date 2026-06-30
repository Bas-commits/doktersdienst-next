import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, isUserInWaarneemgroep } from '@/lib/api-auth';
import {
  aggregateUrentelling,
  collectUrentellingDetails,
  type UrentellingColumn,
  type UrentellingDetailRow,
  type UrentellingRow,
} from '@/lib/urentelling';

const {
  diensten: dienstenTable,
  deelnemers,
  waarneemgroepdeelnemers,
  dienstaantekening,
} = schema;

type Data =
  | {
      van: number;
      tot: number;
      columns: UrentellingColumn[];
      rows: UrentellingRow[];
      details: UrentellingDetailRow[];
    }
  | { error: string };

function parseSingleNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * GET /api/urentelling
 *
 * Query params:
 *   idwaarneemgroep (number)
 *   vanGte (number, Unix seconds) — window start (inclusive)
 *   totLte (number, Unix seconds) — window end (inclusive)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idwaarneemgroep = parseSingleNumber(req.query.idwaarneemgroep);
  const vanGte = parseSingleNumber(req.query.vanGte);
  const totLte = parseSingleNumber(req.query.totLte);

  if (idwaarneemgroep == null) {
    return res.status(400).json({ error: 'Missing or invalid idwaarneemgroep' });
  }
  if (vanGte == null || totLte == null) {
    return res.status(400).json({ error: 'vanGte en totLte moeten beide geldig zijn' });
  }
  if (totLte < vanGte) {
    return res.status(400).json({ error: 'totLte moet na vanGte liggen' });
  }

  if (!user.isAdmin && !(await isUserInWaarneemgroep(user.id, idwaarneemgroep))) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep' });
  }

  try {
    const memberRows = await db
      .select({
        iddeelnemer: deelnemers.id,
        achternaam: deelnemers.achternaam,
        voornaam: deelnemers.voornaam,
        voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
        initialen: deelnemers.initialen,
        color: deelnemers.color,
      })
      .from(waarneemgroepdeelnemers)
      .innerJoin(deelnemers, eq(waarneemgroepdeelnemers.iddeelnemer, deelnemers.id))
      .where(
        and(
          eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
          eq(waarneemgroepdeelnemers.aangemeld, true),
        ),
      )
      .orderBy(asc(deelnemers.achternaam), asc(deelnemers.voornaam));

    const members = memberRows
      .filter((row) => row.iddeelnemer != null)
      .map((row) => ({
        iddeelnemer: row.iddeelnemer!,
        achternaam: row.achternaam,
        voornaam: row.voornaam,
        voorletterstussenvoegsel: row.voorletterstussenvoegsel,
        initialen: row.initialen,
        color: row.color,
      }));

    const aantekeningRows = await db
      .select({
        id: dienstaantekening.id,
        tekst: dienstaantekening.tekst,
        prio: dienstaantekening.prio,
      })
      .from(dienstaantekening)
      .where(
        and(
          eq(dienstaantekening.idwaarneemgroep, idwaarneemgroep),
          or(
            isNull(dienstaantekening.verwijderd),
            eq(dienstaantekening.verwijderd, false),
          ),
        ),
      );

    const aantekeningen = aantekeningRows
      .filter((row) => row.id != null)
      .map((row) => ({
        id: row.id!,
        tekst: row.tekst,
        prio: row.prio,
      }));

    const baseSlotRows = await db
      .select({
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        idaantekening: dienstenTable.idaantekening,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          eq(dienstenTable.type, 1),
          lt(dienstenTable.van, totLte),
          gt(dienstenTable.tot, vanGte),
        ),
      );

    const baseSlots = baseSlotRows.map((row) => ({
      van: Number(row.van ?? 0),
      tot: Number(row.tot ?? 0),
      idaantekening: row.idaantekening,
    }));

    const dienstRows = await db
      .select({
        iddeelnemer: dienstenTable.iddeelnemer,
        iddeelnovern: dienstenTable.iddeelnovern,
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        type: dienstenTable.type,
        status: dienstenTable.status,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          lt(dienstenTable.van, totLte),
          gt(dienstenTable.tot, vanGte),
        ),
      );

    const diensten = dienstRows.map((row) => ({
      iddeelnemer: row.iddeelnemer,
      iddeelnovern: row.iddeelnovern,
      van: Number(row.van ?? 0),
      tot: Number(row.tot ?? 0),
      type: row.type,
      status:
        row.status != null && String(row.status).trim() !== ''
          ? String(row.status).trim().toLowerCase()
          : null,
    }));

    const { columns, rows } = aggregateUrentelling(
      diensten,
      members,
      vanGte,
      totLte,
      baseSlots,
      aantekeningen,
    );
    const details = collectUrentellingDetails(
      diensten,
      members,
      vanGte,
      totLte,
      baseSlots,
      aantekeningen,
    );

    return res.status(200).json({ van: vanGte, tot: totLte, columns, rows, details });
  } catch (err) {
    console.error('[api/urentelling]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
