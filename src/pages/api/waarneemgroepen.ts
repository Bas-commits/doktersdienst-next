import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, isNull, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { findDeelnemerBySessionEmail, GROEP_ADMINISTRATOR } from '@/lib/api-auth';

const { waarneemgroepen, waarneemgroepdeelnemers, deelnemers, taaktypen } = schema;

type WaarneemgroepRow = typeof waarneemgroepen.$inferSelect;
type WaarneemgroepRowWithRole = WaarneemgroepRow & {
  idgroep: number | null;
  plantDiensten: boolean;
};

/**
 * De waarneemgroepen die minstens een taaktype als dienst hebben aangemerkt.
 *
 * Hangt hier aan de lijst met groepen en niet aan de plannercontext, omdat de zijbalk het
 * nodig heeft en die op elke pagina staat. De lijst wordt toch al opgehaald en in de browser
 * bewaard, dus dit kost geen extra verzoek. De plannercontext levert hetzelfde signaal voor de
 * schermen zelf; zie groepPlantDiensten.
 */
async function groepenMetDiensten(): Promise<Set<number>> {
  const rijen = await db
    .select({ idwaarneemgroep: taaktypen.idwaarneemgroep })
    .from(taaktypen)
    .where(
      and(
        eq(taaktypen.isDienst, true),
        or(isNull(taaktypen.verwijderd), eq(taaktypen.verwijderd, 0))
      )
    );
  return new Set(rijen.flatMap((rij) => (rij.idwaarneemgroep == null ? [] : [rij.idwaarneemgroep])));
}
type Data =
  | { waarneemgroepen: WaarneemgroepRowWithRole[] }
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
 * Recreates the legacy query for regular users:
 *   waarneemgroepen left join waarneemgroepdeelnemers on wg.ID = wgd.IDwaarneemgroep
 *   where wgd.aangemeld = 1 and wgd.IDdeelnemer = $user and wg.afgemeld = 0
 *   select wg.*
 *
 * Administrators (deelnemers.idgroep = 5) may select any active waarneemgroep.
 * Requires authentication. Resolves current user to deelnemer by email.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const t0 = Date.now();
  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  const tSession = Date.now() - t0;
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

    const t1 = Date.now();
    const deelnemer = await findDeelnemerBySessionEmail(email);
    const tDeelnemer = Date.now() - t1;

    const idDeelnemer = deelnemer?.id ?? null;
    if (idDeelnemer === null) {
      return res.status(403).json({ error: 'Deelnemer not found' });
    }

    const isAdmin = deelnemer?.idgroep === GROEP_ADMINISTRATOR;
    if (isAdmin) {
      const t2 = Date.now();
      const [rows, metDiensten] = await Promise.all([
        db.select({ wg: waarneemgroepen }).from(waarneemgroepen).where(eq(waarneemgroepen.afgemeld, false)),
        groepenMetDiensten(),
      ]);
      const tQuery = Date.now() - t2;

      if (process.env.NODE_ENV === 'development') {
        console.log('[waarneemgroepen]', {
          sessionMs: tSession,
          deelnemerMs: tDeelnemer,
          mainQueryMs: tQuery,
          totalMs: Date.now() - t0,
          scope: 'admin',
        });
      }

      return res.status(200).json({
        waarneemgroepen: rows.map((r) => ({
          ...r.wg,
          idgroep: GROEP_ADMINISTRATOR,
          plantDiensten: r.wg.id != null && metDiensten.has(r.wg.id),
        })),
      });
    }

    const t2 = Date.now();
    const metDiensten = await groepenMetDiensten();
    const rows = await db
      .select({
        wg: waarneemgroepen,
        wgdIdgroep: waarneemgroepdeelnemers.idgroep,
        wgdIddeelnemer: waarneemgroepdeelnemers.iddeelnemer,
      })
      .from(waarneemgroepen)
      .leftJoin(
        waarneemgroepdeelnemers,
        eq(waarneemgroepen.id, waarneemgroepdeelnemers.idwaarneemgroep)
      )
      .where(
        and(
          eq(waarneemgroepen.afgemeld, false),
          eq(waarneemgroepdeelnemers.aangemeld, true),
          eq(waarneemgroepdeelnemers.iddeelnemer, idDeelnemer)
        )
      );
    const tQuery = Date.now() - t2;

    if (process.env.NODE_ENV === 'development') {
      console.log('[waarneemgroepen]', {
        sessionMs: tSession,
        deelnemerMs: tDeelnemer,
        mainQueryMs: tQuery,
        totalMs: Date.now() - t0,
      });
    }

    // Dedup by wg.id; prefer the row belonging to the current user so idgroep is correct.
    const wgMap = new Map<number | string, WaarneemgroepRowWithRole>();
    rows.forEach((r, i) => {
      const key = r.wg.id ?? `noid-${i}`;
      const existing = wgMap.get(key);
      if (!existing || r.wgdIddeelnemer === idDeelnemer) {
        wgMap.set(key, {
          ...r.wg,
          idgroep: r.wgdIdgroep ?? null,
          plantDiensten: r.wg.id != null && metDiensten.has(r.wg.id),
        });
      }
    });

    return res.status(200).json({ waarneemgroepen: Array.from(wgMap.values()) });
  } catch (err) {
    console.error('waarneemgroepen API error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
