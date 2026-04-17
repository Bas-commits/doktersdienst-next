import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '@/db';
import { getAuthenticatedUser, getUserWaarneemgroepIds } from '@/lib/api-auth';

const { diensten: dienstenTable, deelnemers, dienstaantekening } = schema;
const targetDeelnemer = alias(deelnemers, 'targetDeelnemer');

type Data =
  | { diensten: Array<{
      id: number | null;
      iddeelnemer: number | null;
      van: number;
      tot: number;
      type: number | null;
      idwaarneemgroep: number | null;
      idaantekening: number | null;
      aantekeningTekst: string | null;
      diensten_deelnemers: {
        id: number | null;
        voornaam: string | null;
        achternaam: string | null;
        color: string | null;
      } | null;
    }> }
  | { error: string };

/**
 * GET /api/diensten
 *
 * Query params:
 *   vanGte (number, Unix seconds) - diensten.van >= this
 *   totLte (number, Unix seconds) - diensten.tot <= this
 *   idwaarneemgroepIn (comma-separated IDs) - diensten.idwaarneemgroep in these
 *   typeIn (optional, comma-separated) - diensten.type in these (e.g. 1 = unassigned slots)
 *   iddeelnemer (optional, number) - only return diensten where iddeelnemer = this (e.g. for "my" preferences)
 *
 * Returns diensten with joined deelnemer (voornaam, achternaam, color).
 * Non-admin users can only query groups they belong to.
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

  const typeInRaw = req.query.typeIn;
  const typeIn =
    typeInRaw == null
      ? null
      : Array.isArray(typeInRaw)
        ? typeInRaw.map(Number).filter((n) => !Number.isNaN(n))
        : typeof typeInRaw === 'string'
          ? typeInRaw.split(',').map(Number).filter((n) => !Number.isNaN(n))
          : null;

  const iddeelnemerRaw = req.query.iddeelnemer;
  const iddeelnemer =
    iddeelnemerRaw == null
      ? null
      : Number(Array.isArray(iddeelnemerRaw) ? iddeelnemerRaw[0] : iddeelnemerRaw);
  const iddeelnemerFilter = iddeelnemer != null && !Number.isNaN(iddeelnemer) ? iddeelnemer : null;

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
      return res.status(200).json({ diensten: [] });
    }
    idwaarneemgroepIn.length = 0;
    idwaarneemgroepIn.push(...filtered);
  }

  const whereConditions = [
    gte(dienstenTable.van, vanGte),
    lte(dienstenTable.tot, totLte),
    inArray(dienstenTable.idwaarneemgroep, idwaarneemgroepIn),
  ];
  if (typeIn != null && typeIn.length > 0) {
    whereConditions.push(inArray(dienstenTable.type, typeIn));
  }
  if (iddeelnemerFilter != null) {
    whereConditions.push(eq(dienstenTable.iddeelnemer, iddeelnemerFilter));
  }

  try {
    const rows = await db
      .select({
        id: dienstenTable.id,
        iddeelnemer: dienstenTable.iddeelnemer,
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        type: dienstenTable.type,
        idwaarneemgroep: dienstenTable.idwaarneemgroep,
        idaantekening: dienstenTable.idaantekening,
        aantekeningTekst: dienstaantekening.tekst,
        status: dienstenTable.status,
        iddienstovern: dienstenTable.iddienstovern,
        iddeelnovern: dienstenTable.iddeelnovern,
        senderId: dienstenTable.senderId,
        deelnemerId: deelnemers.id,
        voornaam: deelnemers.voornaam,
        achternaam: deelnemers.achternaam,
        color: deelnemers.color,
        targetDeelnemerId: targetDeelnemer.id,
        targetVoornaam: targetDeelnemer.voornaam,
        targetAchternaam: targetDeelnemer.achternaam,
        targetColor: targetDeelnemer.color,
      })
      .from(dienstenTable)
      .leftJoin(deelnemers, eq(dienstenTable.iddeelnemer, deelnemers.id))
      .leftJoin(targetDeelnemer, eq(dienstenTable.iddeelnovern, targetDeelnemer.id))
      .leftJoin(dienstaantekening, eq(dienstenTable.idaantekening, dienstaantekening.id))
      .where(and(...whereConditions));

    const diensten = rows.map((r) => ({
      id: r.id,
      iddeelnemer: r.iddeelnemer,
      van: Number(r.van ?? 0),
      tot: Number(r.tot ?? 0),
      type: r.type,
      idwaarneemgroep: r.idwaarneemgroep,
      idaantekening: r.idaantekening,
      aantekeningTekst: r.aantekeningTekst,
      status: r.status,
      iddienstovern: r.iddienstovern,
      iddeelnovern: r.iddeelnovern,
      senderId: r.senderId,
      diensten_deelnemers:
        r.deelnemerId != null
          ? {
              id: r.deelnemerId,
              voornaam: r.voornaam,
              achternaam: r.achternaam,
              color: r.color,
            }
          : null,
      target_deelnemers:
        r.targetDeelnemerId != null
          ? {
              id: r.targetDeelnemerId,
              voornaam: r.targetVoornaam,
              achternaam: r.targetAchternaam,
              color: r.targetColor,
            }
          : null,
    }));

    return res.status(200).json({ diensten });
  } catch (err) {
    console.error('[api/diensten]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
