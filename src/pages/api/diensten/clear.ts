import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { diensten: dienstenTable } = schema;

type Data = { success: true; deleted: number } | { error: string };

/**
 * Toewijzingstypen die "leegmaken" verwijdert: Standaard (0), Achterwacht (5), Extra Dokter (11)
 * — de types die assign.ts en autoplanning/confirm zelf schrijven. Type 1 (de basisslots) blijft
 * altijd staan; type 4/6 (legacy Standaard/overname-records) en de voorkeur-types (2,3,9,10,5001)
 * worden bewust niet aangeraakt, om overname-historie en voorkeuren niet ongewild te wissen.
 */
const CLEARABLE_TYPES = [0, 5, 11];

/**
 * POST /api/diensten/clear
 *
 * Verwijdert alle toewijzingen (Standaard/Achterwacht/Extra Dokter) voor één waarneemgroep
 * binnen een periode — de basisslots (type=1) blijven staan, dus de rooster-structuur zelf
 * verandert niet. Gebruikt door de "Rooster leegmaken"-knop (week/maand/jaar) en door het
 * resetten van de Test10 e2e-fixture naar een schone staat vóór autoplanning.
 *
 * Body:
 *   idwaarneemgroep  number
 *   van              number  (Unix seconds) — periode-start, inclusief
 *   tot              number  (Unix seconds) — periode-eind, exclusief
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idwaarneemgroep, van, tot } = req.body as {
    idwaarneemgroep?: number;
    van?: number;
    tot?: number;
  };

  if (typeof idwaarneemgroep !== 'number' || typeof van !== 'number' || typeof tot !== 'number' || tot <= van) {
    return res.status(400).json({ error: 'Waarneemgroep en een geldige periode zijn verplicht' });
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'U kunt niet plannen in deze waarneemgroep. U bent geen secretaris.' });
  }

  try {
    const deleted = await db
      .delete(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          inArray(dienstenTable.type, CLEARABLE_TYPES),
          gte(dienstenTable.van, van),
          lt(dienstenTable.van, tot),
        ),
      )
      .returning({ id: dienstenTable.id });

    return res.status(200).json({ success: true, deleted: deleted.length });
  } catch (err) {
    console.error('[api/diensten/clear]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
