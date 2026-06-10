import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess, isUserInWaarneemgroep } from '@/lib/api-auth';

const { deelnemers } = schema;

type Data = { ok: true } | { error: string };

/**
 * PATCH /api/deelnemers/echtedeelnemer
 *
 * Updates whether a participant may appear on the roster planner.
 * Body: { uid: number, echtedeelnemer: boolean, idwaarneemgroep: number }
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
    const { uid, echtedeelnemer, idwaarneemgroep } = req.body as {
      uid: unknown;
      echtedeelnemer: unknown;
      idwaarneemgroep: unknown;
    };

    if (
      typeof uid !== 'number' ||
      typeof echtedeelnemer !== 'boolean' ||
      typeof idwaarneemgroep !== 'number'
    ) {
      return res.status(400).json({
        error: 'Invalid body: uid (number), echtedeelnemer (boolean) and idwaarneemgroep (number) required',
      });
    }

    const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Geen toegang om deelnemers in deze waarneemgroep te beheren.' });
    }

    const isMember = await isUserInWaarneemgroep(uid, idwaarneemgroep);
    if (!isMember) {
      return res.status(404).json({ error: 'Deelnemer is niet aangemeld in deze waarneemgroep.' });
    }

    await db
      .update(deelnemers)
      .set({ echtedeelnemer })
      .where(eq(deelnemers.id, uid));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('echtedeelnemer API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
