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
 * GET /api/diensten/recurrence-info?id=<n>
 *
 * Returns recurrence info for a shift: whether it has future recurrences,
 * how many, and when the last one is.
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

  const id = Number(req.query.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Ongeldig shift ID.' });
  }

  const { diensten: dienstenTable } = schema;

  try {
    const rows = await db
      .select({
        van: dienstenTable.van,
        iddienstherhalen: dienstenTable.iddienstherhalen,
      })
      .from(dienstenTable)
      .where(eq(dienstenTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(200).json({ has_recurrence: false });
    }

    const { van, iddienstherhalen } = rows[0];

    if (iddienstherhalen == null || van == null) {
      return res.status(200).json({ has_recurrence: false });
    }

    // Count future occurrences (van >= this shift's van) in the same series
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
      future_count: futureCount > 1 ? futureCount - 1 : 0, // exclude self
      last_van: lastVan,
    });
  } catch (err) {
    console.error('[api/diensten/recurrence-info]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
