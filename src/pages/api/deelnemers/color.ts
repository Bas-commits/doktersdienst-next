import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser } from '@/lib/api-auth';

const { deelnemers } = schema;

type Data = { ok: true } | { error: string };

/**
 * PATCH /api/deelnemers/color
 *
 * Updates the color field for a participant.
 * Body: { uid: number, color: string }
 *
 * Only the user themselves or an admin can change a participant's color.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { uid, color } = req.body as { uid: unknown; color: unknown };

    if (typeof uid !== 'number' || typeof color !== 'string') {
      return res.status(400).json({ error: 'Invalid body: uid (number) and color (string) required' });
    }

    if (uid !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Geen toegang om de kleur van een andere deelnemer te wijzigen.' });
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color format' });
    }

    await db
      .update(deelnemers)
      .set({ color })
      .where(eq(deelnemers.id, uid));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('color API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
