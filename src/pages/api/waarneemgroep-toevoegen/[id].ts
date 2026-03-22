import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { waarneemgroepen } = schema;

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true } | { error: string }>
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
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
