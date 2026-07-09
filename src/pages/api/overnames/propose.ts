import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, gte, lt, lte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { logger } from '@/lib/logger';
import { buildLegacyOvernameRowConditions } from '@/lib/overname-legacy-lookup';

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

type DienstRow = {
  id: number | null;
  type: number | null;
  van: number | null;
  tot: number | null;
  iddeelnemer: number | null;
  idwaarneemgroep: number | null;
};

const dienstSelect = {
  id: dienstenTable.id,
  type: dienstenTable.type,
  van: dienstenTable.van,
  tot: dienstenTable.tot,
  iddeelnemer: dienstenTable.iddeelnemer,
  idwaarneemgroep: dienstenTable.idwaarneemgroep,
};

async function findType1SlotRows(
  idwaarneemgroep: number,
  rangeVan: number,
  rangeTot: number,
  exact: boolean,
): Promise<DienstRow[]> {
  if (exact) {
    return db
      .select(dienstSelect)
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.type, 1),
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          eq(dienstenTable.van, rangeVan),
          eq(dienstenTable.tot, rangeTot),
        ),
      )
      .limit(1);
  }

  return db
    .select(dienstSelect)
    .from(dienstenTable)
    .where(
      and(
        eq(dienstenTable.type, 1),
        eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
        lt(dienstenTable.van, rangeTot),
        gt(dienstenTable.tot, rangeVan),
      ),
    )
    .limit(20);
}

function pickPositiveId(rows: Array<{ id: number | null }>): number | null {
  const match = rows.find(row => row.id != null && row.id > 0);
  return match?.id ?? null;
}

async function resolveType1SlotId(
  idwaarneemgroep: number,
  rangeVan: number,
  rangeTot: number,
): Promise<number | null> {
  const exactRows = await findType1SlotRows(idwaarneemgroep, rangeVan, rangeTot, true);
  const exactId = pickPositiveId(exactRows);
  if (exactId != null) {
    return exactId;
  }

  const overlapRows = await findType1SlotRows(idwaarneemgroep, rangeVan, rangeTot, false);
  return pickPositiveId(overlapRows);
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

    const numVan = Number(van);
    const numTot = Number(tot);
    const numIdWaarneemgroep = Number(idwaarneemgroep);
    const numIdDienstOvern = Number(iddienstovern) || 0;
    const numIdDeelnOvern = Number(iddeelnovern);

    if (!numIdDeelnOvern || !numVan || !numTot || !numIdWaarneemgroep) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'missing-required-fields',
        has: {
          iddienstovern: numIdDienstOvern > 0,
          iddeelnovern: !!numIdDeelnOvern,
          van: !!numVan,
          tot: !!numTot,
          idwaarneemgroep: !!numIdWaarneemgroep,
        },
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (numVan >= numTot) {
      logger.warn({
        msg: 'overname-propose:validation',
        reason: 'invalid-time-range',
        van: numVan,
        tot: numTot,
        iddienstovern: numIdDienstOvern,
      });
      return res.status(400).json({ error: 'Invalid time range' });
    }

    logger.info({
      msg: 'overname-propose:request',
      iddienstovern: numIdDienstOvern,
      iddeelnovern: numIdDeelnOvern,
      van: numVan,
      tot: numTot,
      idwaarneemgroep: numIdWaarneemgroep,
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
        iddienstovern: numIdDienstOvern,
        authUserId: session.user.id,
      });
      return res.status(400).json({ error: 'Proposing doctor not found' });
    }

    const senderId = proposingDoctor[0].id;

    let originalDienstRows: DienstRow[] = [];

    if (numIdDienstOvern > 0) {
      originalDienstRows = await db
        .select(dienstSelect)
        .from(dienstenTable)
        .where(eq(dienstenTable.id, numIdDienstOvern))
        .limit(1);
    }

    if (!originalDienstRows.length) {
      originalDienstRows = await findType1SlotRows(
        numIdWaarneemgroep,
        numVan,
        numTot,
        true,
      );
    }

    if (!originalDienstRows.length) {
      originalDienstRows = await findType1SlotRows(
        numIdWaarneemgroep,
        numVan,
        numTot,
        false,
      );
    }

    if (!originalDienstRows.length) {
      const overlapCandidates = await db
        .select(dienstSelect)
        .from(dienstenTable)
        .where(
          and(
            eq(dienstenTable.type, 0),
            eq(dienstenTable.idwaarneemgroep, numIdWaarneemgroep),
            lt(dienstenTable.van, numTot),
            gt(dienstenTable.tot, numVan),
          ),
        )
        .limit(20);

      const mappedAssigned = overlapCandidates
        .slice()
        .sort((a, b) => {
          const aSpan = Number(a.tot ?? 0) - Number(a.van ?? 0);
          const bSpan = Number(b.tot ?? 0) - Number(b.van ?? 0);
          return aSpan - bSpan;
        })[0];

      if (mappedAssigned) {
        originalDienstRows = [mappedAssigned];
      }
    }

    if (!originalDienstRows.length) {
      logger.warn({
        msg: 'overname-propose:not-found',
        reason: 'dienst-missing',
        iddienstovern: numIdDienstOvern,
        van: numVan,
        tot: numTot,
        idwaarneemgroep: numIdWaarneemgroep,
        senderId,
      });
      return res.status(404).json({ error: 'Dienst not found' });
    }

    const original = originalDienstRows[0];
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
            lt(dienstenTable.van, numTot),
            gt(dienstenTable.tot, numVan),
          ),
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
        iddienstovern: numIdDienstOvern,
        senderId,
      });
      return res.status(400).json({ error: 'Only assigned shifts (type=0) can be taken over' });
    }

    if ((!resolvedOriginalId || resolvedOriginalId <= 0) && foundAssignment) {
      const slotId = await resolveType1SlotId(
        original.idwaarneemgroep ?? numIdWaarneemgroep,
        assignmentVan,
        assignmentTot,
      );
      if (slotId != null) {
        resolvedOriginalId = slotId;
      }
    }

    // Clamp van/tot to the resolved type=0 bounds (the type=1 slot may have wider times)
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

    if (!resolvedOriginalId || resolvedOriginalId <= 0) {
      // Legacy PHP rows may have NULL ids on both type=1 slots and type=0 assignments.
      resolvedOriginalId = 0;
      logger.info({
        msg: 'overname-propose:legacy-null-id-fallback',
        assignmentVan,
        assignmentTot,
        assignedDeelnemerId,
        idwaarneemgroep: numIdWaarneemgroep,
        senderId,
      });
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
          eq(waarneemgroepdeelnemers.idwaarneemgroep, numIdWaarneemgroep),
          eq(waarneemgroepdeelnemers.iddeelnemer, numIdDeelnOvern),
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
    const legacyProposalConditions = [
      eq(dienstenTable.type, 4),
      eq(dienstenTable.status, 'pending'),
      buildLegacyOvernameRowConditions({
        idwaarneemgroep: numIdWaarneemgroep,
        van: clampedVan,
        tot: clampedTot,
        iddeelnemer: assignedDeelnemerId,
      }),
    ];

    const existingProposal = await db
      .select({ iddienstovern: dienstenTable.iddienstovern })
      .from(dienstenTable)
      .where(
        resolvedOriginalId > 0
          ? and(
              eq(dienstenTable.type, 4),
              eq(dienstenTable.status, 'pending'),
              eq(dienstenTable.iddienstovern, resolvedOriginalId),
            )
          : and(...legacyProposalConditions),
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
        iddeelnovern: numIdDeelnOvern,
        iddienstovern: resolvedOriginalId,
        iddeelnemer: assignedDeelnemerId,
        senderId,
        van: clampedVan,
        tot: clampedTot,
        idwaarneemgroep: numIdWaarneemgroep,
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
      iddienstovernRequested: numIdDienstOvern,
      senderId,
      iddeelnovern: numIdDeelnOvern,
      clampedVan,
      clampedTot,
      idwaarneemgroep: numIdWaarneemgroep,
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
