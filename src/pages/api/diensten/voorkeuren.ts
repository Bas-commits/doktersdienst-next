import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, getUserWaarneemgroepIds } from '@/lib/api-auth';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers, taaktypen } = schema;

type Voorkeur = {
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  tot: number;
  type: number | null;
  idwaarneemgroep: number | null;
  idtaaktype: number | null;
  taaktypeKleur: string | null;
  deelnemer: {
    id: number | null;
    voornaam: string | null;
    achternaam: string | null;
    color: string | null;
  } | null;
};

type Data = { voorkeuren: Voorkeur[] } | { error: string };

/**
 * GET /api/diensten/voorkeuren
 *
 * Returns voorkeuren (type 2, 3, or type 8 with taaktype.type >= 2) for
 * aangemelde deelnemers in the given waarneemgroep(en), within a time window.
 *
 * Query params:
 *   vanGte        (number, Unix seconds) – dienst.van >= this (week/month start)
 *   totLte        (number, Unix seconds) – dienst.tot <= this (week/month end)
 *   idwaarneemgroepIn (comma-separated IDs)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vanGte = req.query.vanGte != null ? Number(req.query.vanGte) : NaN;
  const totLte = req.query.totLte != null ? Number(req.query.totLte) : NaN;
  const idwaarneemgroepInRaw = req.query.idwaarneemgroepIn;
  const idwaarneemgroepIn = Array.isArray(idwaarneemgroepInRaw)
    ? idwaarneemgroepInRaw.map(Number).filter((n) => !Number.isNaN(n))
    : typeof idwaarneemgroepInRaw === 'string'
      ? idwaarneemgroepInRaw.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : [];

  if (Number.isNaN(vanGte) || Number.isNaN(totLte) || idwaarneemgroepIn.length === 0) {
    return res.status(400).json({
      error: 'Missing or invalid vanGte, totLte, or idwaarneemgroepIn',
    });
  }

  // Non-admin users: restrict to groups they belong to
  if (!user.isAdmin) {
    const allowedIds = new Set(await getUserWaarneemgroepIds(user.id));
    const filtered = idwaarneemgroepIn.filter((id) => allowedIds.has(id));
    if (filtered.length === 0) {
      return res.status(200).json({ voorkeuren: [] });
    }
    idwaarneemgroepIn.length = 0;
    idwaarneemgroepIn.push(...filtered);
  }

  try {
    // Subquery: iddeelnemers who are aangemeld in the given waarneemgroepen
    const aangemeldeSq = db
      .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
      .from(waarneemgroepdeelnemers)
      .where(
        and(
          inArray(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroepIn),
          eq(waarneemgroepdeelnemers.aangemeld, true)
        )
      );

    const rows = await db
      .select({
        id: dienstenTable.id,
        iddeelnemer: dienstenTable.iddeelnemer,
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        type: dienstenTable.type,
        idwaarneemgroep: dienstenTable.idwaarneemgroep,
        idtaaktype: dienstenTable.idtaaktype,
        taaktypeKleur: taaktypen.kleur,
        taaktypeType: taaktypen.type,
        deelnemerId: deelnemers.id,
        voornaam: deelnemers.voornaam,
        achternaam: deelnemers.achternaam,
        color: deelnemers.color,
      })
      .from(dienstenTable)
      .leftJoin(deelnemers, eq(dienstenTable.iddeelnemer, deelnemers.id))
      .leftJoin(taaktypen, eq(dienstenTable.idtaaktype, taaktypen.id))
      .where(
        and(
          // Time window: dienst overlaps with [vanGte, totLte]
          lt(dienstenTable.van, totLte),
          gte(dienstenTable.tot, vanGte),
          // Only aangemelde deelnemers
          inArray(dienstenTable.iddeelnemer, aangemeldeSq),
          // Voorkeur types: 2, 3, 9, 10, 5001 (all preference chips), or type 8 (taken) with taaktype.type >= 2
          or(
            inArray(dienstenTable.type, [2, 3, 9, 10, 5001]),
            and(
              eq(dienstenTable.type, 8),
              sql`${taaktypen.type} >= 2`
            )
          )
        )
      )
      .orderBy(deelnemers.id, dienstenTable.idwaarneemgroep, dienstenTable.id);

    const voorkeuren: Voorkeur[] = rows.map((r) => ({
      id: r.id,
      iddeelnemer: r.iddeelnemer,
      van: Number(r.van ?? 0),
      tot: Number(r.tot ?? 0),
      type: r.type,
      idwaarneemgroep: r.idwaarneemgroep,
      idtaaktype: r.idtaaktype,
      taaktypeKleur: r.taaktypeKleur ?? null,
      deelnemer:
        r.deelnemerId != null
          ? {
              id: r.deelnemerId,
              voornaam: r.voornaam,
              achternaam: r.achternaam,
              color: r.color,
            }
          : null,
    }));

    return res.status(200).json({ voorkeuren });
  } catch (err) {
    console.error('[api/diensten/voorkeuren]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
