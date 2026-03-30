import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser } from '@/lib/api-auth';

const { waarneemgroepen } = schema;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true } | { error: string }>
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Alleen administrators kunnen waarneemgroepen verwijderen.' });
  }

  const id = Number(req.query.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const rows = await db
      .select({ id: waarneemgroepen.id })
      .from(waarneemgroepen)
      .where(eq(waarneemgroepen.id, id))
      .limit(1);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Waarneemgroep niet gevonden' });
    }

    await db
      .update(waarneemgroepen)
      .set({ afgemeld: true })
      .where(eq(waarneemgroepen.id, id));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/waarneemgroep-toevoegen/${id} error`, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
