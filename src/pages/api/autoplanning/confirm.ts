import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import { applyAssignment, type DienstSection } from '@/lib/assign-dienst';

type Data = { success: true } | { error: string };

type ConfirmedAssignment = {
  van: number;
  tot: number;
  section: DienstSection;
  iddeelnemer: number;
};

const SECTIONS: DienstSection[] = ['middle', 'top', 'bottom'];

/**
 * POST /api/autoplanning/confirm
 *
 * Schrijft een (eventueel door de secretaris aangepast) voorstel van
 * /api/autoplanning/generate weg. Elk item wordt exact als een handmatige
 * /api/diensten/assign-toewijzing verwerkt (zelfde delete-then-insert logica,
 * via de gedeelde applyAssignment-helper), binnen één transactie.
 *
 * Body:
 *   idwaarneemgroep  number
 *   assignments      { van, tot, section, iddeelnemer }[]
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idwaarneemgroep, assignments } = req.body as {
    idwaarneemgroep?: number;
    assignments?: ConfirmedAssignment[];
  };

  if (typeof idwaarneemgroep !== 'number' || !Array.isArray(assignments)) {
    return res.status(400).json({ error: 'Waarneemgroep en assignments zijn verplicht' });
  }

  for (const a of assignments) {
    if (
      typeof a.van !== 'number' ||
      typeof a.tot !== 'number' ||
      typeof a.iddeelnemer !== 'number' ||
      !SECTIONS.includes(a.section)
    ) {
      return res.status(400).json({ error: 'Ongeldige toewijzing in assignments' });
    }
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'U kunt niet plannen in deze waarneemgroep. U bent geen secretaris.' });
  }

  try {
    await db.transaction(async (tx) => {
      for (const a of assignments) {
        await applyAssignment(tx, {
          idwaarneemgroep,
          van: a.van,
          tot: a.tot,
          section: a.section,
          iddeelnemer: a.iddeelnemer,
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/autoplanning/confirm]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
