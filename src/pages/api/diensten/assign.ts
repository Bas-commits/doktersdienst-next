import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, isNull } from 'drizzle-orm';
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
  bottom: 9,
};

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
 *   - type=0: regular (Standaard) assignment  → section=middle
 *   - type=5: Achterwacht assignment           → section=top
 *   - type=9: Extra Dokter assignment          → section=bottom
 *
 * Behaviour:
 *   - If an assignment record of the target type already exists → update iddeelnemer
 *   - Otherwise → insert a new record, copying idpraktijk/idshift/currentDate/nextDate
 *     from the type=1 base record.
 *   - If iddeelnemer is null (unassign) → delete the assignment record if it exists.
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
    // Find the type=1 base record for this slot
    const [base] = await db
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
          isNull(dienstenTable.iddeelnemer),
        )
      )
      .limit(1);

    // Find existing assignment record of the target type
    const [existing] = await db
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

    if (isUnassign) {
      // Remove the assignment record if it exists
      if (existing?.id != null) {
        await db
          .delete(dienstenTable)
          .where(eq(dienstenTable.id, existing.id));
      }
      return res.status(200).json({ success: true });
    }

    if (typeof iddeelnemer !== 'number') {
      return res.status(400).json({ error: 'iddeelnemer must be a number' });
    }

    if (existing?.id != null) {
      // Update existing assignment record
      await db
        .update(dienstenTable)
        .set({ iddeelnemer })
        .where(eq(dienstenTable.id, existing.id));
    } else {
      // Insert new assignment record, copying metadata from the base slot
      await db.insert(dienstenTable).values({
        idwaarneemgroep,
        van,
        tot,
        type: targetType,
        iddeelnemer,
        idpraktijk: base?.idpraktijk ?? null,
        idshift: base?.idshift ?? null,
        currentDate: base?.currentDate ?? null,
        nextDate: base?.nextDate ?? null,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/diensten/assign]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
