import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

type Data = { success: true; message: string } | { error: string };

/**
 * POST /api/diensten/delete-shift
 *
 * Body: { van: number, tot: number, idwaarneemgroep: number, delete_future_recurrences?: boolean }
 *
 * Deletes a single type=1 dienst identified by van+tot+idwaarneemgroep,
 * or the shift and all future recurrences when delete_future_recurrences=true.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const van = Number(body?.van);
  const tot = Number(body?.tot);
  const idwaarneemgroep = Number(body?.idwaarneemgroep);
  const deleteFutureRecurrences = body?.delete_future_recurrences === true;

  if (Number.isNaN(van) || Number.isNaN(tot) || Number.isNaN(idwaarneemgroep)) {
    return res.status(400).json({ error: 'Ongeldige van, tot of idwaarneemgroep.' });
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
  }

  const { diensten: dienstenTable } = schema;

  try {
    // Look up the exact row to get iddienstherhalen
    const rows = await db
      .select({
        iddienstherhalen: dienstenTable.iddienstherhalen,
      })
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

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shift niet gevonden.' });
    }

    const { iddienstherhalen } = rows[0];

    if (deleteFutureRecurrences && iddienstherhalen != null) {
      await db
        .delete(dienstenTable)
        .where(
          and(
            eq(dienstenTable.iddienstherhalen, iddienstherhalen),
            gte(dienstenTable.van, van),
            eq(dienstenTable.type, 1)
          )
        );
      return res.status(200).json({ success: true, message: 'Shift en toekomstige herhalingen verwijderd.' });
    }

    await db
      .delete(dienstenTable)
      .where(
        and(
          eq(dienstenTable.van, van),
          eq(dienstenTable.tot, tot),
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          eq(dienstenTable.type, 1)
        )
      );

    return res.status(200).json({ success: true, message: 'Shift verwijderd.' });
  } catch (err) {
    console.error('[api/diensten/delete-shift]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
