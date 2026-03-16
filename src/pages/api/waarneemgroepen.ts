import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { waarneemgroepen, waarneemgroepdeelnemers, deelnemers } = schema;

type WaarneemgroepRow = typeof waarneemgroepen.$inferSelect;
type Data =
  | { waarneemgroepen: WaarneemgroepRow[] }
  | { error: string };

/** Convert Next API request headers to Headers for Better Auth */
function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/waarneemgroepen
 *
 * Recreates the legacy query:
 *   waarneemgroepen left join waarneemgroepdeelnemers on wg.ID = wgd.IDwaarneemgroep
 *   where ((wgd.aangemeld = 1 and wgd.IDdeelnemer = $user) or wg.IDregio = $idRegio) and wg.afgemeld = 0
 *   select wg.*
 *
 * Requires authentication. Resolves current user to deelnemer by email.
 * Optional query param: idRegio (number) to also include groups in that regio.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const email = session.user.email;
    if (!email) {
      return res.status(403).json({
        error: 'No email on session; cannot resolve deelnemer',
      });
    }

    const [deelnemer] = await db
      .select({ id: deelnemers.id })
      .from(deelnemers)
      .where(eq(deelnemers.email, email))
      .limit(1);

    const idDeelnemer = deelnemer?.id ?? null;
    const idRegioParam = req.query.idRegio;
    const idRegio =
      idRegioParam !== undefined && idRegioParam !== ''
        ? Number(idRegioParam)
        : undefined;

    const orConditions = [
      and(
        eq(waarneemgroepdeelnemers.aangemeld, true),
        idDeelnemer !== null
          ? eq(waarneemgroepdeelnemers.iddeelnemer, idDeelnemer)
          : eq(waarneemgroepdeelnemers.iddeelnemer, -1)
      ),
    ];
    if (idRegio !== undefined && !Number.isNaN(idRegio)) {
      orConditions.push(eq(waarneemgroepen.idregio, idRegio));
    }

    const rows = await db
      .select({ wg: waarneemgroepen })
      .from(waarneemgroepen)
      .leftJoin(
        waarneemgroepdeelnemers,
        eq(waarneemgroepen.id, waarneemgroepdeelnemers.idwaarneemgroep)
      )
      .where(
        and(eq(waarneemgroepen.afgemeld, false), or(...orConditions))
      );

    const unique = Array.from(
      new Map(
        rows.map((r, i) => [r.wg.id ?? `noid-${i}`, r.wg])
      ).values()
    );

    return res.status(200).json({ waarneemgroepen: unique });
  } catch (err) {
    console.error('waarneemgroepen API error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
