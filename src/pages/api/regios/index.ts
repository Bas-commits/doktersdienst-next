import type { NextApiRequest, NextApiResponse } from 'next';
import { asc, max } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser } from '@/lib/api-auth';

const { regios } = schema;

export type RegioItem = {
  id: number;
  naam: string;
};

const NAAM_MIN = 4;
const NAAM_MAX = 40;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ regios: RegioItem[] } | { success: true } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST' && !user.isAdmin) {
    return res.status(403).json({ error: 'Alleen administrators kunnen regio\'s toevoegen.' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await db
        .select({ id: regios.id, naam: regios.naam })
        .from(regios)
        .orderBy(asc(regios.naam));

      return res.status(200).json({
        regios: rows
          .filter((r) => r.id != null && r.naam != null)
          .map((r) => ({ id: r.id!, naam: r.naam! })),
      });
    } catch (err) {
      console.error('GET /api/regios error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  // POST
  const { naam } = req.body as { naam?: unknown };
  if (typeof naam !== 'string' || naam.trim().length < NAAM_MIN || naam.trim().length > NAAM_MAX) {
    return res.status(400).json({ error: `Naam moet tussen ${NAAM_MIN} en ${NAAM_MAX} tekens zijn.` });
  }

  try {
    const trimmed = naam.trim();

    const [maxRow] = await db.select({ maxId: max(regios.id) }).from(regios);
    const newId = (maxRow?.maxId ?? 0) + 1;

    await db.insert(regios).values({ id: newId, naam: trimmed });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST /api/regios error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
