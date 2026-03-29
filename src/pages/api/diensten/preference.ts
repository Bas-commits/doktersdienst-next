import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { logger } from '@/lib/logger';

const { diensten: dienstenTable } = schema;

const PREFERENCE_TYPES = [2, 3, 9, 10, 5001] as const;

type Data = { success: true } | { error: string };

/** Convert Next API request headers to Headers for Better Auth */
function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/** Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" to YYYY-MM-DD for date column */
function toDateOnly(s: string | undefined): string | undefined {
  if (s == null || s === '') return undefined;
  const part = s.split(' ')[0] ?? s;
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : undefined;
}

/**
 * POST /api/diensten/preference
 *
 * Body: { action: 'add' | 'remove', van: number, tot: number, idwaarneemgroep: number, type?: number, currentDate?: string, nextDate?: string }
 * Adds or removes one preference row (type in 2,3,9,10,5001) for the current user.
 * At most one preference per (slot, user) is enforced by DB unique index.
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

  const idDeelnemer = Number(session.user.id);
  if (Number.isNaN(idDeelnemer)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const action = body?.action;
  const van = body?.van != null ? Number(body.van) : NaN;
  const tot = body?.tot != null ? Number(body.tot) : NaN;
  const idwaarneemgroep = body?.idwaarneemgroep != null ? Number(body.idwaarneemgroep) : NaN;
  const type = body?.type != null ? Number(body.type) : NaN;
  const currentDate = toDateOnly(body?.currentDate);
  const nextDate = toDateOnly(body?.nextDate);

  if (action !== 'add' && action !== 'remove') {
    return res.status(400).json({ error: 'Missing or invalid action (use add or remove)' });
  }
  if (Number.isNaN(van) || Number.isNaN(tot) || Number.isNaN(idwaarneemgroep)) {
    return res.status(400).json({ error: 'Missing or invalid van, tot, or idwaarneemgroep' });
  }
  if (action === 'add') {
    if (Number.isNaN(type) || !PREFERENCE_TYPES.includes(type as (typeof PREFERENCE_TYPES)[number])) {
      return res.status(400).json({ error: 'Missing or invalid type for add (use 2, 3, 9, 10, or 5001)' });
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(dienstenTable)
        .where(
          and(
            eq(dienstenTable.van, van),
            eq(dienstenTable.tot, tot),
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            eq(dienstenTable.iddeelnemer, idDeelnemer),
            inArray(dienstenTable.type, [...PREFERENCE_TYPES])
          )
        );

      if (action === 'add') {
        await tx.insert(dienstenTable).values({
          van,
          tot,
          idwaarneemgroep,
          iddeelnemer: idDeelnemer,
          type: type as number,
          ...(currentDate != null && { currentDate }),
          ...(nextDate != null && { nextDate }),
        });
      }
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('unique') || message.includes('duplicate') || message.includes('diensten_one_preference_per_slot_user')) {
      return res.status(200).json({ success: true });
    }
    logger.error(
      { err, action: body?.action, van, tot, idwaarneemgroep, idDeelnemer },
      'Failed to save preference'
    );
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
