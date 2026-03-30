import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser } from '@/lib/api-auth';

const { regios } = schema;

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
    return res.status(403).json({ error: 'Alleen administrators kunnen regio\'s verwijderen.' });
  }

  const id = Number(req.query.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const [existing] = await db
      .select({ id: regios.id })
      .from(regios)
      .where(eq(regios.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Regio niet gevonden' });
    }

    await db.delete(regios).where(eq(regios.id, id));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/regios/[id] error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
