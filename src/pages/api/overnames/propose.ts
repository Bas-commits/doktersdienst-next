import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, gte, lt, lte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { logger } from '@/lib/logger';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;

type Data = { success: true; id?: number } | { error: string };

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
    logger.warn({ msg: 'overname-propose:method-not-allowed', method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    logger.warn({ msg: 'overname-propose:unauthorized' });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { iddienstovern, iddeelnovern, van, tot, idwaarneemgroep } = req.body;

    if (!iddienstovern || !iddeelnovern || !van || !tot || !idwaarneemgroep) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'missing-required-fields',
        has: {
          iddienstovern: !!iddienstovern,
          iddeelnovern: !!iddeelnovern,
          van: van != null,
          tot: tot != null,
          idwaarneemgroep: !!idwaarneemgroep,
        },
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (van >= tot) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'invalid-time-range',
        van,
        tot,
        iddienstovern,
      });
      return res.status(400).json({ error: 'Invalid time range' });
    }

    logger.info({
      msg: 'overname-propose:request',
      iddienstovern,
      iddeelnovern,
      van,
      tot,
      idwaarneemgroep,
    });

    // Get the proposing doctor's deelnemer ID from session
    const proposingDoctor = await db
      .select({ id: deelnemers.id })
      .from(deelnemers)
      .where(eq(deelnemers.login, session.user.email))
      .limit(1);

    if (!proposingDoctor.length) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'proposing-doctor-not-found',
        iddienstovern,
        authUserId: session.user.id,
      });
      return res.status(400).json({ error: 'Proposing doctor not found' });
    }

    const senderId = proposingDoctor[0].id;

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
      logger.warn({
        msg: 'overname-propose:not-found',
        reason: 'dienst-missing',
        iddienstovern,
        senderId,
      });
      return res.status(404).json({ error: 'Dienst not found' });
    }

    const original = originalDienst[0];
    logger.info({
      msg: 'overname-propose:original-dienst',
      id: original.id,
      type: original.type,
      iddeelnemer: original.iddeelnemer,
      idwaarneemgroep: original.idwaarneemgroep,
      van: original.van,
      tot: original.tot,
      senderId,
    });
    // resolvedOriginalId: the dienst id to reference in the overname record.
    // For type=1 slots, we keep the slot id since legacy type=0 rows often have NULL id.
    let resolvedOriginalId = original.id;
    let assignedDeelnemerId = original.iddeelnemer;
    let foundAssignment = original.type === 0;
    let assignmentVan = Number(original.van ?? 0);
    let assignmentTot = Number(original.tot ?? 0);

    if (original.type === 1) {
      // Find type=0 assignment that overlaps this slot's time range.
      // Legacy PHP creates type=0 rows with NULL id, so we cannot filter on id.
      const mappedAssignedCandidates = await db
        .select({
          id: dienstenTable.id,
          type: dienstenTable.type,
          van: dienstenTable.van,
          tot: dienstenTable.tot,
          iddeelnemer: dienstenTable.iddeelnemer,
          idwaarneemgroep: dienstenTable.idwaarneemgroep,
        })
        .from(dienstenTable)
        .where(
          and(
            eq(dienstenTable.type, 0),
            eq(dienstenTable.idwaarneemgroep, original.idwaarneemgroep ?? 0),
            lt(dienstenTable.van, tot),
            gt(dienstenTable.tot, van)
          )
        )
        .limit(20);

      logger.info({
        msg: 'overname-propose:type1-slot-mapping',
        slotId: original.id,
        overlapCandidates: mappedAssignedCandidates.length,
        idwaarneemgroep: original.idwaarneemgroep,
        senderId,
      });

      const mappedAssigned = mappedAssignedCandidates
        .slice()
        .sort((a, b) => {
          const aSpan = Number(a.tot ?? 0) - Number(a.van ?? 0);
          const bSpan = Number(b.tot ?? 0) - Number(b.van ?? 0);
          return aSpan - bSpan;
        })[0];
      if (mappedAssigned) {
        foundAssignment = true;
        assignedDeelnemerId = mappedAssigned.iddeelnemer;
        assignmentVan = Number(mappedAssigned.van ?? 0);
        assignmentTot = Number(mappedAssigned.tot ?? 0);
        // Use the type=0's id if it has one, otherwise keep the type=1 slot id
        if (mappedAssigned.id != null && mappedAssigned.id > 0) {
          resolvedOriginalId = mappedAssigned.id;
        }
        logger.info({
          msg: 'overname-propose:mapped-assignment',
          resolvedOriginalId,
          assignmentId: mappedAssigned.id,
          assignedDeelnemerId,
          assignmentVan,
          assignmentTot,
          senderId,
        });
      }
    }

    if (!foundAssignment) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'no-type0-assignment',
        originalType: original.type,
        iddienstovern,
        senderId,
      });
      return res.status(400).json({ error: 'Only assigned shifts (type=0) can be taken over' });
    }

    if (!resolvedOriginalId || resolvedOriginalId <= 0) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'unresolved-dienst-ref',
        originalType: original.type,
        iddienstovern,
        senderId,
      });
      return res.status(400).json({ error: 'Could not resolve dienst reference' });
    }

    // Clamp van/tot to the resolved type=0 bounds (the type=1 slot may have wider times)
    const numVan = Number(van);
    const numTot = Number(tot);
    const clampedVan = Math.max(numVan, assignmentVan);
    const clampedTot = Math.min(numTot, assignmentTot);
    if (clampedVan >= clampedTot) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'clamp-empty-range',
        numVan,
        numTot,
        assignmentVan,
        assignmentTot,
        clampedVan,
        clampedTot,
        resolvedOriginalId,
        senderId,
      });
      return res.status(400).json({ error: 'Invalid time range' });
    }

    logger.info({
      msg: 'overname-propose:time-clamped',
      numVan,
      numTot,
      assignmentVan,
      assignmentTot,
      clampedVan,
      clampedTot,
      resolvedOriginalId,
      senderId,
    });

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
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'target-not-in-waarneemgroep',
        iddeelnovern,
        idwaarneemgroep,
        senderId,
      });
      return res.status(400).json({ error: 'Target doctor is not in the same waarneemgroep' });
    }

    // Check no existing pending proposal for the same original dienst
    const existingProposal = await db
      .select({ iddienstovern: dienstenTable.iddienstovern })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.type, 4),
          eq(dienstenTable.status, 'pending'),
          eq(dienstenTable.iddienstovern, resolvedOriginalId)
        )
      )
      .limit(1);

    if (existingProposal.length) {
      logger.warn({
        msg: 'overname-propose:conflict',
        reason: 'pending-proposal-exists',
        existingProposalId: existingProposal[0]?.iddienstovern,
        iddienstovernResolved: resolvedOriginalId,
        senderId,
      });
      return res.status(409).json({ error: 'Active proposal already exists for this shift' });
    }

    // Create the overname voorstel
    // Note: diensten.id has no auto-increment (legacy), so .returning() yields null.
    await db
      .insert(dienstenTable)
      .values({
        type: 4,
        status: 'pending',
        iddeelnovern,
        iddienstovern: resolvedOriginalId,
        iddeelnemer: assignedDeelnemerId,
        senderId,
        van: clampedVan,
        tot: clampedTot,
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
      });

    logger.info({
      msg: 'overname-propose:created',
      resolvedOriginalId,
      iddienstovernRequested: iddienstovern,
      senderId,
      iddeelnovern,
      clampedVan,
      clampedTot,
      idwaarneemgroep,
      assignedDeelnemerId,
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    logger.error({
      err,
      msg: 'overname-propose-error',
      body: req.body,
    });
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
