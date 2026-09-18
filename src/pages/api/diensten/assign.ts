import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import { applyAssignment, type DienstSection } from '@/lib/assign-dienst';

type Data = { success: true } | { error: string };

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
 * See src/lib/assign-dienst.ts for the write semantics — shared with
 * /api/autoplanning/confirm.
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
    return res.status(403).json({ error: 'U kunt niet plannen in deze waarneemgroep. U bent geen secretaris.' });
  }

  try {
    await db.transaction(async (tx) => {
      await applyAssignment(tx, {
        idwaarneemgroep,
        van,
        tot,
        iddeelnemer: iddeelnemer as number | null | undefined,
        section: section as DienstSection,
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
