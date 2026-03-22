import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

type Data =
  | { has_recurrence: boolean; future_count?: number; last_van?: number }
  | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/diensten/recurrence-info?van=<n>&tot=<n>&idwaarneemgroep=<n>
 *
 * Returns recurrence info for a shift slot identified by van+tot+idwaarneemgroep.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const van = Number(req.query.van);
  const tot = Number(req.query.tot);
  const idwaarneemgroep = Number(req.query.idwaarneemgroep);

  if (Number.isNaN(van) || Number.isNaN(tot) || Number.isNaN(idwaarneemgroep)) {
    return res.status(400).json({ error: 'Ongeldige van, tot of idwaarneemgroep.' });
  }

  const { diensten: dienstenTable } = schema;

  try {
    const rows = await db
      .select({ iddienstherhalen: dienstenTable.iddienstherhalen })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.van, van),
          eq(dienstenTable.tot, tot),
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          eq(dienstenTable.type, 1)
        )
      )
      .limit(1);

    const iddienstherhalen = rows[0]?.iddienstherhalen;

    if (iddienstherhalen == null) {
      return res.status(200).json({ has_recurrence: false });
    }

    const futureRows = await db
      .select({
        count: sql<number>`count(*)::int`,
        lastVan: sql<number>`max(van)`,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.iddienstherhalen, iddienstherhalen),
          gte(dienstenTable.van, van),
          eq(dienstenTable.type, 1)
        )
      );

    const futureCount = Number(futureRows[0]?.count ?? 0);
    const lastVan = futureRows[0]?.lastVan != null ? Number(futureRows[0].lastVan) : undefined;

    return res.status(200).json({
      has_recurrence: futureCount > 1,
      future_count: futureCount > 1 ? futureCount - 1 : 0,
      last_van: lastVan,
    });
  } catch (err) {
    console.error('[api/diensten/recurrence-info]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
