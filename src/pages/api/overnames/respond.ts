import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, or } from 'drizzle-orm';
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

    const doctorId = currentDoctor[0]?.id;
    if (!doctorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find the proposal by composite key.
    // Delete can target pending, declined (type=4) and accepted (type=6) proposals.
    // Accept/decline only targets pending (type=4).
    const lookupCondition = and(
      eq(dienstenTable.iddienstovern, iddienstovern),
      action === 'delete'
        ? or(
            and(eq(dienstenTable.type, 4), or(eq(dienstenTable.status, 'pending'), eq(dienstenTable.status, 'declined'))),
            and(eq(dienstenTable.type, 6), eq(dienstenTable.status, 'accepted'))
          )
        : and(eq(dienstenTable.type, 4), eq(dienstenTable.status, 'pending'))
    );

    const proposal = await db
      .select({
        iddienstovern: dienstenTable.iddienstovern,
        iddeelnovern: dienstenTable.iddeelnovern,
        senderId: dienstenTable.senderId,
        idwaarneemgroep: dienstenTable.idwaarneemgroep,
        status: dienstenTable.status,
      })
      .from(dienstenTable)
      .where(lookupCondition)
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
      await db.delete(dienstenTable).where(lookupCondition);
      logger.info({ msg: 'overname-respond:deleted', iddienstovern, doctorId, isSecretaris });
    } else {
      // Target doctor or secretaris can accept/decline
      if (iddeelnovern !== doctorId && !isSecretaris) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Only pending proposals can be accepted/declined (already enforced by lookupCondition)
      const pendingCondition = and(
        eq(dienstenTable.iddienstovern, iddienstovern),
        eq(dienstenTable.type, 4),
        eq(dienstenTable.status, 'pending')
      );
      if (action === 'accept') {
        await db
          .update(dienstenTable)
          .set({ type: 6, status: 'accepted' })
          .where(pendingCondition);
        logger.info({ msg: 'overname-respond:accepted', iddienstovern, doctorId, isSecretaris });
      } else {
        await db
          .update(dienstenTable)
          .set({ status: 'declined' })
          .where(pendingCondition);
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
