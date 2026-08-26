import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { listGroepChoicesForNewDeelnemer, resolveDeelnemerCreatePermission } from '@/lib/deelnemer-nieuw';

export type DeelnemerNieuwGroepChoice = { id: number; naam: string | null };

/** Actieve functies van de gekozen waarneemgroep. Leeg als er geen groep is meegegeven. */
export type DeelnemerNieuwFunctieChoice = { id: number; naam: string };

export type DeelnemerNieuwOptiesResponse =
  | {
      allowed: true;
      groepen: DeelnemerNieuwGroepChoice[];
      functies: DeelnemerNieuwFunctieChoice[];
    }
  | {
      allowed: false;
      forbiddenReason: string;
      groepen: DeelnemerNieuwGroepChoice[];
      functies: DeelnemerNieuwFunctieChoice[];
    }
  | { error: string };

/**
 * GET /api/deelnemers/nieuw/opties — whether the caller may create a deelnemer + rol-opties voor het formulier.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<DeelnemerNieuwOptiesResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const idwaarneemgroepRaw =
      typeof req.query.idwaarneemgroep === 'string'
        ? req.query.idwaarneemgroep
        : Array.isArray(req.query.idwaarneemgroep)
          ? req.query.idwaarneemgroep[0]
          : null;
    const idwaarneemgroep =
      idwaarneemgroepRaw != null && idwaarneemgroepRaw !== ''
        ? Number(idwaarneemgroepRaw)
        : null;

    const perm = await resolveDeelnemerCreatePermission(user, idwaarneemgroep);
    if (!perm.ok) {
      return res
        .status(200)
        .json({ allowed: false, forbiddenReason: perm.forbiddenReason, groepen: [], functies: [] });
    }
    const [groepen, functies] = await Promise.all([
      listGroepChoicesForNewDeelnemer(),
      idwaarneemgroep != null && Number.isInteger(idwaarneemgroep)
        ? db
            .select({
              id: schema.praktijkplannerfuncties.id,
              naam: schema.praktijkplannerfuncties.naam,
            })
            .from(schema.praktijkplannerfuncties)
            .where(
              and(
                eq(schema.praktijkplannerfuncties.idwaarneemgroep, idwaarneemgroep),
                eq(schema.praktijkplannerfuncties.actief, true)
              )
            )
            .orderBy(asc(schema.praktijkplannerfuncties.naam))
        : Promise.resolve([]),
    ]);
    return res.status(200).json({ allowed: true, groepen, functies });
  } catch (err) {
    console.error('deelnemers/nieuw/opties error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
