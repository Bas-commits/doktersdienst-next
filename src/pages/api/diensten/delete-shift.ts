import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

type Data = { success: true; message: string } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * POST /api/diensten/delete-shift
 *
 * Body: { id: number, delete_future_recurrences?: boolean }
 *
 * Deletes a single type=1 dienst by id, or the shift and all future recurrences
 * if delete_future_recurrences=true and the shift is part of a recurrence series.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const id = Number(body?.id);
  const deleteFutureRecurrences = body?.delete_future_recurrences === true;

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Ongeldig shift ID.' });
  }

  const { diensten: dienstenTable } = schema;

  try {
    // Fetch the dienst to get iddienstherhalen and van
    const rows = await db
      .select({
        id: dienstenTable.id,
        van: dienstenTable.van,
        iddienstherhalen: dienstenTable.iddienstherhalen,
      })
      .from(dienstenTable)
      .where(eq(dienstenTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shift niet gevonden.' });
    }

    const dienst = rows[0];

    if (
      deleteFutureRecurrences &&
      dienst.iddienstherhalen != null &&
      dienst.van != null
    ) {
      // Delete this shift and all future occurrences in the same recurrence series
      await db
        .delete(dienstenTable)
        .where(
          and(
            eq(dienstenTable.iddienstherhalen, dienst.iddienstherhalen),
            gte(dienstenTable.van, dienst.van),
            eq(dienstenTable.type, 1)
          )
        );

      return res.status(200).json({ success: true, message: 'Shift en toekomstige herhalingen verwijderd.' });
    }

    // Delete only this single shift
    await db.delete(dienstenTable).where(eq(dienstenTable.id, id));

    return res.status(200).json({ success: true, message: 'Shift verwijderd.' });
  } catch (err) {
    console.error('[api/diensten/delete-shift]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
