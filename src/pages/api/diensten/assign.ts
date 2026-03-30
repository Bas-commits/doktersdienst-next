import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { diensten: dienstenTable } = schema;

type Data = { success: true } | { error: string };

const SECTION_TYPE: Record<string, number> = {
  middle: 0,
  top: 5,
  bottom: 9, // Extra Dokter (legacy PHP type)
};

/** Legacy DB: Standaard rows may be type 0, 4, or 6 (see PHP diensten.verwijderen / shift.persoon2). */
const MIDDLE_ASSIGNMENT_TYPES = [0, 4, 6] as const;

/** Extra Dokter: legacy PHP uses 9; older Next rows may still be type 11 (see useDienstenSchedule). */
const BOTTOM_ASSIGNMENT_TYPES = [9, 11] as const;

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
 *   - type=9 or 11: Extra Dokter               → section=bottom (11 deprecated; still cleared on assign/unassign)
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

  const user = await getAuthenticatedUser(req);
  if (!user) {
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

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
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

      // Build the overlap clause for this section's assignment types.
      // Overlap matching handles legacy split assignments whose van/tot
      // may be a sub-range of the type=1 base slot.
      const sectionTypes =
        section === 'middle'
          ? [...MIDDLE_ASSIGNMENT_TYPES]
          : section === 'bottom'
            ? [...BOTTOM_ASSIGNMENT_TYPES]
            : [targetType];
      const overlapClause = and(
        eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
        inArray(dienstenTable.type, sectionTypes),
        lt(dienstenTable.van, tot),
        gt(dienstenTable.tot, van),
      );

      if (isUnassign) {
        // Delete ALL overlapping assignment records for this section.
        // Uses the WHERE clause directly — safe even for rows with NULL id.
        await tx.delete(dienstenTable).where(overlapClause);
        return;
      }

      // Delete-then-insert strategy: remove ALL existing overlapping records for this
      // section first, then insert exactly one. This prevents duplicates (legacy data or
      // race conditions) and cleans up split assignments from the PHP system.
      // Uses WHERE clause directly — safe even for rows with NULL id.
      await tx.delete(dienstenTable).where(overlapClause);

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
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/diensten/assign]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
