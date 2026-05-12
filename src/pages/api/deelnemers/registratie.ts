import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { waarneemgroepdeelnemers } = schema;
const GELDIGE_WAARNEEMGROEP_FUNCTIES = new Set([1, 2, 3, 4]);

type Actie = 'aanmelden' | 'afmelden' | 'groep' | 'functie';

type Data = { ok: true } | { error: string };

/**
 * POST /api/deelnemers/registratie
 *
 * Handles participant group registration actions:
 * - aanmelden: register participant in a waarneemgroep (upsert aangemeld = true)
 * - afmelden: unregister participant from a waarneemgroep (set aangemeld = false)
 * - groep: change participant's role in a waarneemgroep
 * - functie: change participant's functie in a waarneemgroep
 *
 * Body: { actie, IDdeelnemer, IDwaarneemgroep, IDgroep?, IDfunctie? }
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

  try {
    const { actie, IDdeelnemer, IDwaarneemgroep, IDgroep, IDfunctie } = req.body as {
      actie: unknown;
      IDdeelnemer: unknown;
      IDwaarneemgroep: unknown;
      IDgroep?: unknown;
      IDfunctie?: unknown;
    };

    if (
      typeof actie !== 'string' ||
      !['aanmelden', 'afmelden', 'groep', 'functie'].includes(actie) ||
      typeof IDdeelnemer !== 'number' ||
      typeof IDwaarneemgroep !== 'number'
    ) {
      return res.status(400).json({ error: 'Invalid body' });
    }

    const hasAccess = await hasGroupManagementAccess(user, IDwaarneemgroep);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Geen toegang om registraties in deze waarneemgroep te beheren.' });
    }

    const typedActie = actie as Actie;

    if (typedActie === 'aanmelden') {
      // Check for existing record
      const [existing] = await db
        .select({ id: waarneemgroepdeelnemers.id })
        .from(waarneemgroepdeelnemers)
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, IDdeelnemer),
            eq(waarneemgroepdeelnemers.idwaarneemgroep, IDwaarneemgroep)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(waarneemgroepdeelnemers)
          .set({ aangemeld: true })
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, IDdeelnemer),
              eq(waarneemgroepdeelnemers.idwaarneemgroep, IDwaarneemgroep)
            )
          );
      } else {
        await db.insert(waarneemgroepdeelnemers).values({
          iddeelnemer: IDdeelnemer,
          idwaarneemgroep: IDwaarneemgroep,
          aangemeld: true,
        });
      }
    } else if (typedActie === 'afmelden') {
      await db
        .update(waarneemgroepdeelnemers)
        .set({ aangemeld: false })
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, IDdeelnemer),
            eq(waarneemgroepdeelnemers.idwaarneemgroep, IDwaarneemgroep)
          )
        );
    } else if (typedActie === 'groep') {
      if (typeof IDgroep !== 'number') {
        return res.status(400).json({ error: 'IDgroep required for groep action' });
      }
      await db
        .update(waarneemgroepdeelnemers)
        .set({ idgroep: IDgroep })
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, IDdeelnemer),
            eq(waarneemgroepdeelnemers.idwaarneemgroep, IDwaarneemgroep)
          )
        );
    } else if (typedActie === 'functie') {
      const functie = IDfunctie === null ? null : IDfunctie;
      if (functie !== null && typeof functie !== 'number') {
        return res.status(400).json({ error: 'IDfunctie must be a number or null for functie action' });
      }
      if (
        functie !== null &&
        (!Number.isInteger(functie) || !GELDIGE_WAARNEEMGROEP_FUNCTIES.has(functie))
      ) {
        return res.status(400).json({ error: 'IDfunctie heeft een ongeldige waarde' });
      }
      await db
        .update(waarneemgroepdeelnemers)
        .set({ idfunctie: functie })
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, IDdeelnemer),
            eq(waarneemgroepdeelnemers.idwaarneemgroep, IDwaarneemgroep)
          )
        );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('registratie API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
