import type { NextApiRequest, NextApiResponse } from 'next';
import { and, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { gesprekken, deelnemers } = schema;

type GesprekDto = {
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  vannummer: string | null;
  naarnummer: string | null;
  recordingShow: number | null;
  recordingFilename: string | null;
  wasBridged: boolean;
  talkDurationSec: number;
  deelnemer: {
    id: number;
    voornaam: string | null;
    achternaam: string | null;
    voorletterstussenvoegsel: string | null;
  } | null;
};

type Data = { gesprekken: GesprekDto[] } | { error: string };

function parseSingleNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

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

  const idwaarneemgroep = parseSingleNumber(req.query.idwaarneemgroep);
  if (idwaarneemgroep == null) {
    return res.status(400).json({ error: 'Missing or invalid idwaarneemgroep' });
  }

  const vanGte = parseSingleNumber(req.query.vanGte);
  const vanLte = parseSingleNumber(req.query.vanLte);
  const hasRangeInput = req.query.vanGte != null || req.query.vanLte != null;
  if (hasRangeInput && (vanGte == null || vanLte == null)) {
    return res.status(400).json({ error: 'vanGte en vanLte moeten beide geldig zijn' });
  }

  if (!user.isAdmin) {
    const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep' });
    }
  }

  const deelnemerQRaw = Array.isArray(req.query.deelnemerQ)
    ? req.query.deelnemerQ[0]
    : req.query.deelnemerQ;
  const deelnemerQ = deelnemerQRaw?.trim() ?? '';

  const whereConditions: SQL[] = [eq(gesprekken.idwaarneemgroep, idwaarneemgroep)];

  if (vanGte != null && vanLte != null) {
    whereConditions.push(gte(gesprekken.van, vanGte));
    whereConditions.push(lte(gesprekken.van, vanLte));
  }

  if (deelnemerQ.length > 0) {
    const like = `%${deelnemerQ}%`;
    whereConditions.push(
      or(
        ilike(deelnemers.voornaam, like),
        ilike(deelnemers.achternaam, like),
        ilike(deelnemers.voorletterstussenvoegsel, like)
      )!
    );
  }

  try {
    const rows = await db
      .select({
        id: gesprekken.id,
        iddeelnemer: gesprekken.iddeelnemer,
        van: gesprekken.van,
        vannummer: gesprekken.vannummer,
        naarnummer: gesprekken.naarnummer,
        recordingShow: gesprekken.recordingShow,
        recordingFilename: gesprekken.recordingFilename,
        wasBridged: gesprekken.wasBridged,
        talkDurationSec: gesprekken.talkDurationSec,
        deelnemerId: deelnemers.id,
        deelnemerVoornaam: deelnemers.voornaam,
        deelnemerAchternaam: deelnemers.achternaam,
        deelnemerTussenvoegsel: deelnemers.voorletterstussenvoegsel,
      })
      .from(gesprekken)
      .leftJoin(deelnemers, eq(gesprekken.iddeelnemer, deelnemers.id))
      .where(and(...whereConditions))
      .orderBy(desc(gesprekken.van))
      .limit(500);

    const payload: GesprekDto[] = rows.map((row) => ({
      id: row.id,
      iddeelnemer: row.iddeelnemer,
      van: Number(row.van ?? 0),
      vannummer: row.vannummer,
      naarnummer: row.naarnummer,
      recordingShow: row.recordingShow,
      recordingFilename: row.recordingFilename,
      wasBridged: row.wasBridged ?? false,
      talkDurationSec: row.talkDurationSec ?? 0,
      deelnemer:
        row.deelnemerId != null
          ? {
              id: row.deelnemerId,
              voornaam: row.deelnemerVoornaam,
              achternaam: row.deelnemerAchternaam,
              voorletterstussenvoegsel: row.deelnemerTussenvoegsel,
            }
          : null,
    }));

    return res.status(200).json({ gesprekken: payload });
  } catch (error) {
    console.error('[api/gesprekken]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
