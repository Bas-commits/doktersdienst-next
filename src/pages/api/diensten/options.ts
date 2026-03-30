import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import { getAuthenticatedUser, isUserInWaarneemgroep } from '@/lib/api-auth';

type Data =
  | {
      aantekeningen: { id: number; tekst: string | null; idtariefDefault: number | null }[];
      tarieven: { id: number; omschrijving: string }[];
    }
  | { error: string };

/**
 * GET /api/diensten/options?idwaarneemgroep=<n>
 *
 * Returns aantekeningen and tarieven for the given waarneemgroep.
 * Tarieven are fetched from ddtarieven (raw SQL) and returned as empty array if unavailable.
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

  const idwaarneemgroep = Number(req.query.idwaarneemgroep);
  if (Number.isNaN(idwaarneemgroep) || idwaarneemgroep <= 0) {
    return res.status(400).json({ error: 'Missing or invalid idwaarneemgroep' });
  }

  if (!user.isAdmin && !(await isUserInWaarneemgroep(user.id, idwaarneemgroep))) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
  }

  try {
    const aantekeningen = await db
      .select({
        id: schema.dienstaantekening.id,
        tekst: schema.dienstaantekening.tekst,
        idtariefDefault: schema.dienstaantekening.idtariefDefault,
      })
      .from(schema.dienstaantekening)
      .where(
        and(
          eq(schema.dienstaantekening.idwaarneemgroep, idwaarneemgroep),
          or(
            isNull(schema.dienstaantekening.verwijderd),
            eq(schema.dienstaantekening.verwijderd, false)
          )
        )
      );

    let tarieven: { id: number; omschrijving: string }[] = [];
    try {
      const result = await pool.query<{ id: number; omschrijving: string }>(
        'SELECT id, omschrijving FROM ddtarieven WHERE idwaarneemgroep = $1 ORDER BY id',
        [idwaarneemgroep]
      );
      tarieven = result.rows;
    } catch {
      // ddtarieven table not available - tarieven remain empty
    }

    return res.status(200).json({
      aantekeningen: aantekeningen.map((a) => ({
        id: a.id ?? 0,
        tekst: a.tekst,
        idtariefDefault: a.idtariefDefault,
      })),
      tarieven,
    });
  } catch (err) {
    console.error('[api/diensten/options]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
