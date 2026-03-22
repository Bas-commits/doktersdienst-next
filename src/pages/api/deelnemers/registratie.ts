import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { waarneemgroepdeelnemers } = schema;

type Actie = 'aanmelden' | 'afmelden' | 'groep';

type Data = { ok: true } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * POST /api/deelnemers/registratie
 *
 * Handles participant group registration actions:
 * - aanmelden: register participant in a waarneemgroep (upsert aangemeld = true)
 * - afmelden: unregister participant from a waarneemgroep (set aangemeld = false)
 * - groep: change participant's role in a waarneemgroep
 *
 * Body: { actie, IDdeelnemer, IDwaarneemgroep, IDgroep? }
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

  try {
    const { actie, IDdeelnemer, IDwaarneemgroep, IDgroep } = req.body as {
      actie: unknown;
      IDdeelnemer: unknown;
      IDwaarneemgroep: unknown;
      IDgroep?: unknown;
    };

    if (
      typeof actie !== 'string' ||
      !['aanmelden', 'afmelden', 'groep'].includes(actie) ||
      typeof IDdeelnemer !== 'number' ||
      typeof IDwaarneemgroep !== 'number'
    ) {
      return res.status(400).json({ error: 'Invalid body' });
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
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('registratie API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
