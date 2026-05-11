import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { logger } from '@/lib/logger';
import { GROEP_ADMINISTRATOR, GROEP_SECRETARIS } from '@/lib/roles';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;

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
 *   iddienstovern  number  — ID of the original dienst (fallback key for legacy delete flow)
 *   overnameId     number  — Optional ID of the specific overname row to mutate/delete
 *   deleteStatus   string  — Optional delete filter: "pending" | "declined" | "accepted"
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
    const { iddienstovern, overnameId, deleteStatus, action } = req.body;
    const iddienstovernNum = Number(iddienstovern);
    const overnameIdNum =
      overnameId == null ? null : Number(overnameId);

    if (action !== 'accept' && action !== 'decline' && action !== 'delete') {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (
      (action === 'accept' || action === 'decline') &&
      (!Number.isFinite(iddienstovernNum) || iddienstovernNum <= 0)
    ) {
      return res.status(400).json({ error: 'Invalid iddienstovern' });
    }
    if (
      action === 'delete' &&
      (!Number.isFinite(overnameIdNum ?? NaN) || (overnameIdNum ?? 0) <= 0) &&
      (!Number.isFinite(iddienstovernNum) || iddienstovernNum <= 0)
    ) {
      return res.status(400).json({ error: 'Invalid delete target' });
    }
    if (
      action === 'delete' &&
      deleteStatus != null &&
      deleteStatus !== 'pending' &&
      deleteStatus !== 'declined' &&
      deleteStatus !== 'accepted'
    ) {
      return res.status(400).json({ error: 'Invalid delete status filter' });
    }

    // Get the logged-in doctor's deelnemer ID and global idgroep (administrator)
    const currentDoctor = await db
      .select({ id: deelnemers.id, idgroep: deelnemers.idgroep })
      .from(deelnemers)
      .where(eq(deelnemers.login, session.user.email))
      .limit(1);

    const doctorId = currentDoctor[0]?.id;
    if (!doctorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const isGlobalAdmin = currentDoctor[0]?.idgroep === GROEP_ADMINISTRATOR;

    // Find the proposal by composite key.
    // Delete can target pending, declined (type=4) and accepted (type=6) proposals.
    // Accept/decline only targets pending (type=4).
    const deleteStateCondition =
      deleteStatus === 'pending'
        ? and(eq(dienstenTable.type, 4), eq(dienstenTable.status, 'pending'))
        : deleteStatus === 'declined'
          ? and(eq(dienstenTable.type, 4), eq(dienstenTable.status, 'declined'))
          : deleteStatus === 'accepted'
            ? and(eq(dienstenTable.type, 6), eq(dienstenTable.status, 'accepted'))
            : or(
                and(eq(dienstenTable.type, 4), or(eq(dienstenTable.status, 'pending'), eq(dienstenTable.status, 'declined'))),
                and(eq(dienstenTable.type, 6), eq(dienstenTable.status, 'accepted'))
              );
    const lookupCondition = action === 'delete'
      ? and(
          overnameIdNum != null && Number.isFinite(overnameIdNum) && overnameIdNum > 0
            ? eq(dienstenTable.id, overnameIdNum)
            : eq(dienstenTable.iddienstovern, iddienstovernNum),
          deleteStateCondition
        )
      : and(
          eq(dienstenTable.iddienstovern, iddienstovernNum),
          eq(dienstenTable.type, 4),
          eq(dienstenTable.status, 'pending')
        );

    const proposal = await db
      .select({
        id: dienstenTable.id,
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

    const { id: proposalId, iddienstovern: proposalDienstOvernId, iddeelnovern, senderId, idwaarneemgroep } = proposal[0];

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

    const canManageViaRole = isSecretaris || isGlobalAdmin;

    if (action === 'delete') {
      // Sender, secretaris, or administrator can delete/cancel a proposal
      if (senderId !== doctorId && !canManageViaRole) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      await db.delete(dienstenTable).where(lookupCondition);
      logger.info({
        msg: 'overname-respond:deleted',
        proposalId,
        iddienstovern: proposalDienstOvernId,
        doctorId,
        isSecretaris,
        isGlobalAdmin,
      });
    } else {
      // Target doctor, secretaris, or administrator can accept/decline
      if (iddeelnovern !== doctorId && !canManageViaRole) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Only pending proposals can be accepted/declined (already enforced by lookupCondition)
      const pendingCondition = and(
        eq(dienstenTable.iddienstovern, proposalDienstOvernId),
        eq(dienstenTable.type, 4),
        eq(dienstenTable.status, 'pending')
      );
      if (action === 'accept') {
        await db
          .update(dienstenTable)
          .set({ type: 6, status: 'accepted' })
          .where(pendingCondition);
        logger.info({
          msg: 'overname-respond:accepted',
          iddienstovern: iddienstovernNum,
          doctorId,
          isSecretaris,
          isGlobalAdmin,
        });
      } else {
        await db
          .update(dienstenTable)
          .set({ status: 'declined' })
          .where(pendingCondition);
        logger.info({
          msg: 'overname-respond:declined',
          iddienstovern: iddienstovernNum,
          doctorId,
          isSecretaris,
          isGlobalAdmin,
        });
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
