import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { logger } from '@/lib/logger';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;
const GROEP_SECRETARIS = 2;

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
 * Accept, decline, or delete an overname voorstel.
 *
 * Body:
 *   iddienstovern  number  — ID of the original dienst (unique key for pending proposals)
 *   action         string  — "accept", "decline", or "delete"
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

  try {
    const { iddienstovern, action } = req.body;

    if (!iddienstovern || (action !== 'accept' && action !== 'decline' && action !== 'delete')) {
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

    // Find the proposal by composite key (iddienstovern is unique per pending proposal)
    const proposalCondition = and(
      eq(dienstenTable.iddienstovern, iddienstovern),
      eq(dienstenTable.type, 4),
      eq(dienstenTable.status, 'pending')
    );

    const proposal = await db
      .select({
        iddienstovern: dienstenTable.iddienstovern,
        iddeelnovern: dienstenTable.iddeelnovern,
        senderId: dienstenTable.senderId,
        idwaarneemgroep: dienstenTable.idwaarneemgroep,
      })
      .from(dienstenTable)
      .where(proposalCondition)
      .limit(1);

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const { iddeelnovern, senderId, idwaarneemgroep } = proposal[0];

    // Check if the current user is secretaris of this waarneemgroep
    const isSecretaris = idwaarneemgroep != null && (await db
      .select({ idgroep: waarneemgroepdeelnemers.idgroep })
      .from(waarneemgroepdeelnemers)
      .where(
        and(
          eq(waarneemgroepdeelnemers.iddeelnemer, doctorId),
          eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep)
        )
      )
      .limit(1)
    ).some((r) => r.idgroep === GROEP_SECRETARIS);

    if (action === 'delete') {
      // Sender or secretaris can delete/cancel a proposal
      if (senderId !== doctorId && !isSecretaris) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      await db.delete(dienstenTable).where(proposalCondition);
      logger.info({ msg: 'overname-respond:deleted', iddienstovern, doctorId, isSecretaris });
    } else {
      // Target doctor or secretaris can accept/decline
      if (iddeelnovern !== doctorId && !isSecretaris) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (action === 'accept') {
        await db
          .update(dienstenTable)
          .set({ type: 6, status: 'accepted' })
          .where(proposalCondition);
        logger.info({ msg: 'overname-respond:accepted', iddienstovern, doctorId, isSecretaris });
      } else {
        await db
          .update(dienstenTable)
          .set({ status: 'declined' })
          .where(proposalCondition);
        logger.info({ msg: 'overname-respond:declined', iddienstovern, doctorId, isSecretaris });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err, msg: 'overname-respond:error', body: req.body });
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
