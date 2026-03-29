import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { diensten: dienstenTable } = schema;

type Data = { success: true } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

const SECTION_TYPE: Record<string, number> = {
  middle: 0,
  top: 5,
  bottom: 9, // Extra Dokter (legacy PHP type)
};

/** Legacy DB: Standaard rows may be type 0, 4, or 6 (see PHP diensten.verwijderen / shift.persoon2). */
const MIDDLE_ASSIGNMENT_TYPES = [0, 4, 6] as const;

/**
 * POST /api/diensten/assign
 *
 * Assigns or removes a doctor from a shift stripe (middle/top/bottom).
 *
 * Body:
 *   idwaarneemgroep  number
 *   van              number  (Unix seconds)
 *   tot              number  (Unix seconds)
 *   iddeelnemer      number  (doctor to assign); omit or null to unassign
 *   section          'middle' | 'top' | 'bottom'
 *
 * Database model:
 *   - type=1 record: always present, defines the unassigned slot (never modified here)
 *   - type=0, 4, or 6: regular (Standaard) assignment  → section=middle (legacy uses 4 and 6 too)
 *   - type=5: Achterwacht assignment           → section=top
 *   - type=9: Extra Dokter                     → section=bottom
 *
 * Behaviour:
 *   - If an assignment record of the target type already exists → update iddeelnemer
 *   - Otherwise → insert a new record, copying idpraktijk/idshift/currentDate/nextDate
 *     from the type=1 base record.
 *   - If iddeelnemer is null (unassign) → delete the assignment record if it exists.
 *   - Middle (Standaard): legacy rows may span a wider interval than the type=1 chunk; match
 *     using interval overlap (van < slotTot AND tot > slotVan), same as PHP shift.persoon2.
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

  const { idwaarneemgroep, van, tot, iddeelnemer, section } = req.body ?? {};

  if (
    typeof idwaarneemgroep !== 'number' ||
    typeof van !== 'number' ||
    typeof tot !== 'number' ||
    !['middle', 'top', 'bottom'].includes(section)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const targetType = SECTION_TYPE[section as string];
  const isUnassign = iddeelnemer == null;

  try {
    await db.transaction(async (tx) => {
      // Find the type=1 base record (iddeelnemer=0 is the convention for unassigned base slots)
      const [base] = await tx
        .select({
          id: dienstenTable.id,
          idpraktijk: dienstenTable.idpraktijk,
          idshift: dienstenTable.idshift,
          currentDate: dienstenTable.currentDate,
          nextDate: dienstenTable.nextDate,
        })
        .from(dienstenTable)
        .where(
          and(
            eq(dienstenTable.van, van),
            eq(dienstenTable.tot, tot),
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            eq(dienstenTable.type, 1),
          )
        )
        .limit(1);

      if (isUnassign) {
        if (section === 'middle') {
          const overlapClause = and(
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            inArray(dienstenTable.type, [...MIDDLE_ASSIGNMENT_TYPES]),
            lt(dienstenTable.van, tot),
            gt(dienstenTable.tot, van),
          );
          const victims = await tx
            .select({ id: dienstenTable.id })
            .from(dienstenTable)
            .where(overlapClause);
          for (const v of victims) {
            if (v.id != null) {
              await tx.delete(dienstenTable).where(eq(dienstenTable.id, v.id));
            }
          }
          return;
        }
        const [ex] = await tx
          .select({ id: dienstenTable.id })
          .from(dienstenTable)
          .where(
            and(
              eq(dienstenTable.van, van),
              eq(dienstenTable.tot, tot),
              eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
              eq(dienstenTable.type, targetType),
            )
          )
          .limit(1);
        if (ex?.id != null) {
          await tx.delete(dienstenTable).where(eq(dienstenTable.id, ex.id));
        }
        return;
      }

      let existingId: number | null = null;
      if (section === 'middle') {
        const exactMiddle = and(
          eq(dienstenTable.van, van),
          eq(dienstenTable.tot, tot),
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          inArray(dienstenTable.type, [...MIDDLE_ASSIGNMENT_TYPES]),
        );
        let [row] = await tx
          .select({ id: dienstenTable.id })
          .from(dienstenTable)
          .where(exactMiddle)
          .limit(1);
        if (!row?.id) {
          const overlapMiddle = and(
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            inArray(dienstenTable.type, [...MIDDLE_ASSIGNMENT_TYPES]),
            lt(dienstenTable.van, tot),
            gt(dienstenTable.tot, van),
          );
          [row] = await tx
            .select({ id: dienstenTable.id })
            .from(dienstenTable)
            .where(overlapMiddle)
            .limit(1);
        }
        existingId = row?.id ?? null;
      } else {
        const [row] = await tx
          .select({ id: dienstenTable.id })
          .from(dienstenTable)
          .where(
            and(
              eq(dienstenTable.van, van),
              eq(dienstenTable.tot, tot),
              eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
              eq(dienstenTable.type, targetType),
            )
          )
          .limit(1);
        existingId = row?.id ?? null;
      }

      if (existingId != null) {
        await tx
          .update(dienstenTable)
          .set({ iddeelnemer: iddeelnemer as number })
          .where(eq(dienstenTable.id, existingId));
      } else {
        await tx.insert(dienstenTable).values({
          idwaarneemgroep,
          van,
          tot,
          type: targetType,
          iddeelnemer: iddeelnemer as number,
          idpraktijk: base?.idpraktijk ?? null,
          idshift: base?.idshift ?? null,
          currentDate: base?.currentDate ?? null,
          nextDate: base?.nextDate ?? null,
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/diensten/assign]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
