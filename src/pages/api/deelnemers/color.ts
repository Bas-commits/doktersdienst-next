import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { deelnemers } = schema;

type Data = { ok: true } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * PATCH /api/deelnemers/color
 *
 * Updates the color field for a participant.
 * Body: { uid: number, color: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { uid, color } = req.body as { uid: unknown; color: unknown };

    if (typeof uid !== 'number' || typeof color !== 'string') {
      return res.status(400).json({ error: 'Invalid body: uid (number) and color (string) required' });
    }

    // Validate color is a hex color
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
