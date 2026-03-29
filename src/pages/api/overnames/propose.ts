import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;

type Data = { success: true; id: number } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * POST /api/overnames/propose
 *
 * Creates an overname voorstel (type=4, status=pending).
 *
 * Body:
 *   iddienstovern    number  — ID of the original dienst being taken over
 *   iddeelnovern     number  — ID of the target doctor
 *   van              number  — Start time (Unix seconds)
 *   tot              number  — End time (Unix seconds)
 *   idwaarneemgroep  number  — Waarneemgroep ID
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

  const { iddienstovern, iddeelnovern, van, tot, idwaarneemgroep } = req.body;

  if (!iddienstovern || !iddeelnovern || !van || !tot || !idwaarneemgroep) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (van >= tot) {
    return res.status(400).json({ error: 'Invalid time range' });
  }

  // Get the proposing doctor's deelnemer ID from session
  const proposingDoctor = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(eq(deelnemers.login, session.user.email))
    .limit(1);

  if (!proposingDoctor.length) {
    return res.status(400).json({ error: 'Proposing doctor not found' });
  }

  const senderId = proposingDoctor[0].id;

  // Prevent self-proposal
  if (senderId === iddeelnovern) {
    return res.status(400).json({ error: 'Cannot propose overname to yourself' });
  }

  // Verify original dienst exists and is type=0 (assigned shift)
  const originalDienst = await db
    .select({
      id: dienstenTable.id,
      type: dienstenTable.type,
      van: dienstenTable.van,
      tot: dienstenTable.tot,
      iddeelnemer: dienstenTable.iddeelnemer,
      idwaarneemgroep: dienstenTable.idwaarneemgroep,
    })
    .from(dienstenTable)
    .where(eq(dienstenTable.id, iddienstovern))
    .limit(1);

  if (!originalDienst.length) {
    return res.status(404).json({ error: 'Dienst not found' });
  }

  const original = originalDienst[0];

  if (original.type !== 0) {
    return res.status(400).json({ error: 'Only assigned shifts (type=0) can be taken over' });
  }

  // Verify van/tot within original shift bounds
  const origVan = Number(original.van ?? 0);
  const origTot = Number(original.tot ?? 0);
  if (van < origVan || tot > origTot) {
    return res.status(400).json({ error: 'Invalid time range' });
  }

  // Verify target doctor is in the same waarneemgroep
  const targetInGroup = await db
    .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
        eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnovern)
      )
    )
    .limit(1);

  if (!targetInGroup.length) {
    return res.status(400).json({ error: 'Target doctor is not in the same waarneemgroep' });
  }

  // Check no existing pending proposal for the same original dienst
  const existingProposal = await db
    .select({ id: dienstenTable.id })
    .from(dienstenTable)
    .where(
      and(
        eq(dienstenTable.type, 4),
        eq(dienstenTable.status, 'pending'),
        eq(dienstenTable.iddienstovern, iddienstovern)
      )
    )
    .limit(1);

  if (existingProposal.length) {
    return res.status(409).json({ error: 'Active proposal already exists for this shift' });
  }

  // Create the overname voorstel
  const inserted = await db
    .insert(dienstenTable)
    .values({
      type: 4,
      status: 'pending',
      iddeelnovern,
      iddienstovern,
      iddeelnemer: original.iddeelnemer,
      senderId,
      van,
      tot,
      idwaarneemgroep,
      idpraktijk: 0,
      rol: 0,
      iddienstherhalen: 0,
      idaantekening: 0,
      idshift: 0,
      idtarief: 0,
      idkamer: 0,
      idtelnr: 0,
      idlocatie: 0,
      iddeelnemer2: 0,
      idtaaktype: 0,
      deleteRequest: 0,
    })
    .returning({ id: dienstenTable.id });

  const newId = inserted[0]?.id;
  if (!newId) {
    return res.status(500).json({ error: 'Failed to create proposal' });
  }

  return res.status(201).json({ success: true, id: newId });
}
