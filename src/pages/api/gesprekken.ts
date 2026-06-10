import type { NextApiRequest, NextApiResponse } from 'next';
import { and, desc, eq, gt, gte, ilike, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { gesprekken, deelnemers } = schema;

/** Minimum seconds to count as a real call for legacy rows (no talk_duration_sec). */
const MIN_CALL_DURATION_SEC = 5;
/** Upper bound for legacy span-based duration to ignore corrupt tot/van values. */
const MAX_LEGACY_CALL_DURATION_SEC = 7200;

type GesprekDto = {
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  tot: number;
  vannummer: string | null;
  naarnummer: string | null;
  talkDurationSec: number;
  deelnemer: {
    id: number;
    naam: string;
    initials: string;
    color: string;
    voornaam: string | null;
    achternaam: string | null;
    voorletterstussenvoegsel: string | null;
  } | null;
};

function formatDeelnemerNaam(fields: {
  achternaam: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
}): string {
  return [fields.achternaam, fields.voornaam, fields.voorletterstussenvoegsel]
    .filter(Boolean)
    .join(', ');
}

function formatDeelnemerInitials(fields: {
  voornaam: string | null;
  achternaam: string | null;
}): string {
  const fallback = [fields.voornaam, fields.achternaam]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().charAt(0).toUpperCase())
    .join('');
  return fallback.slice(0, 3) || '—';
}

function resolveTalkDurationSec(talkDurationSec: number | null, van: number, tot: number): number {
  if (talkDurationSec != null && talkDurationSec > 0) return talkDurationSec;
  const span = tot - van;
  if (span >= MIN_CALL_DURATION_SEC && span <= MAX_LEGACY_CALL_DURATION_SEC) return span;
  return 0;
}

/** Real calls: new rows use talk_duration_sec; legacy rows use tot-van when dialstatus is absent. */
function isRealCallCondition(): SQL {
  const spanSeconds = sql<number>`(${gesprekken.tot} - ${gesprekken.van})`;
  return or(
    gt(gesprekken.talkDurationSec, 0),
    and(
      isNull(gesprekken.dialstatus),
      isNotNull(gesprekken.iddeelnemer),
      gte(spanSeconds, MIN_CALL_DURATION_SEC),
      lte(spanSeconds, MAX_LEGACY_CALL_DURATION_SEC),
    ),
  )!;
}

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

  const whereConditions: SQL[] = [
    eq(gesprekken.idwaarneemgroep, idwaarneemgroep),
    isRealCallCondition(),
  ];

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
        tot: gesprekken.tot,
        vannummer: gesprekken.vannummer,
        naarnummer: gesprekken.naarnummer,
        talkDurationSec: gesprekken.talkDurationSec,
        deelnemerId: deelnemers.id,
        deelnemerVoornaam: deelnemers.voornaam,
        deelnemerAchternaam: deelnemers.achternaam,
        deelnemerTussenvoegsel: deelnemers.voorletterstussenvoegsel,
        deelnemerColor: deelnemers.color,
      })
      .from(gesprekken)
      .leftJoin(deelnemers, eq(gesprekken.iddeelnemer, deelnemers.id))
      .where(and(...whereConditions))
      .orderBy(desc(gesprekken.van))
      .limit(500);

    const payload: GesprekDto[] = rows.map((row) => {
      const van = Number(row.van ?? 0);
      const tot = Number(row.tot ?? 0);
      const talkDurationSec = resolveTalkDurationSec(row.talkDurationSec, van, tot);

      return {
        id: row.id,
        iddeelnemer: row.iddeelnemer,
        van,
        tot,
        vannummer: row.vannummer,
        naarnummer: row.naarnummer,
        talkDurationSec,
        deelnemer:
          row.deelnemerId != null
            ? {
                id: row.deelnemerId,
                naam: formatDeelnemerNaam({
                  achternaam: row.deelnemerAchternaam,
                  voornaam: row.deelnemerVoornaam,
                  voorletterstussenvoegsel: row.deelnemerTussenvoegsel,
                }),
                initials: formatDeelnemerInitials({
                  voornaam: row.deelnemerVoornaam,
                  achternaam: row.deelnemerAchternaam,
                }),
                color: row.deelnemerColor?.trim() || '#cccccc',
                voornaam: row.deelnemerVoornaam,
                achternaam: row.deelnemerAchternaam,
                voorletterstussenvoegsel: row.deelnemerTussenvoegsel,
              }
            : null,
      };
    });

    return res.status(200).json({ gesprekken: payload });
  } catch (error) {
    console.error('[api/gesprekken]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
