import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { diensten: dienstenTable, deelnemers } = schema;

type Data = { success: true } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * POST /api/overnames/respond
 *
 * Accept or decline an overname voorstel.
 *
 * Body:
 *   id      number  — ID of the type=4 dienst (the proposal)
 *   action  string  — "accept" or "decline"
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

  const { id, action } = req.body;

  if (!id || (action !== 'accept' && action !== 'decline')) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Get the logged-in doctor's deelnemer ID
  const currentDoctor = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(eq(deelnemers.login, session.user.email))
    .limit(1);

  if (!currentDoctor.length) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const doctorId = currentDoctor[0].id;

  // Find the proposal
  const proposal = await db
    .select({
      id: dienstenTable.id,
      type: dienstenTable.type,
      status: dienstenTable.status,
      iddeelnovern: dienstenTable.iddeelnovern,
    })
    .from(dienstenTable)
    .where(
      and(
        eq(dienstenTable.id, id),
        eq(dienstenTable.type, 4),
        eq(dienstenTable.status, 'pending')
      )
    )
    .limit(1);

  if (!proposal.length) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  // Verify the logged-in user is the target doctor
  if (proposal[0].iddeelnovern !== doctorId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (action === 'accept') {
    await db
      .update(dienstenTable)
      .set({ type: 6, status: 'accepted' })
      .where(eq(dienstenTable.id, id));
  } else {
    await db
      .update(dienstenTable)
      .set({ status: 'declined' })
      .where(eq(dienstenTable.id, id));
  }

  return res.status(200).json({ success: true });
}
