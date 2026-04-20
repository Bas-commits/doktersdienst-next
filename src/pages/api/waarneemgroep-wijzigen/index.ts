import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { waarneemgroepen, waarneemgroepdeelnemers, deelnemers, specialismen, regios, instellingen } = schema;

const ADMIN_GROEP_ID = 5;
const SECRETARIS_GROEP_ID = 2;

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export type WaarneemgroepListItem = { id: number; naam: string };
export type SpecialismeItem = { id: number; omschrijving: string };
export type RegioItem = { id: number; naam: string };
export type InstellingItem = { id: number; naam: string };

export type WaarneemgroepWijzigenOptions = {
  waarneemgroepen: WaarneemgroepListItem[];
  specialismen: SpecialismeItem[];
  regios: RegioItem[];
  instellingen: InstellingItem[];
  waarneemgroepenForInvoegende: WaarneemgroepListItem[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WaarneemgroepWijzigenOptions | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const deelnemerId = Number(session.user.id);
  if (Number.isNaN(deelnemerId)) {
    return res.status(403).json({ error: 'Invalid user id' });
  }

  try {
    // Fetch the user's idgroep alongside the lookup tables in parallel
    const [deelnemerRow, specialismenRows, regiosRows, instellingenRows] = await Promise.all([
      db
        .select({ idgroep: deelnemers.idgroep })
        .from(deelnemers)
        .where(eq(deelnemers.id, deelnemerId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: specialismen.id, omschrijving: specialismen.omschrijving })
        .from(specialismen)
        .orderBy(asc(specialismen.omschrijving)),
      db
        .select({ id: regios.id, naam: regios.naam })
        .from(regios)
        .orderBy(asc(regios.naam)),
      db
        .select({ id: instellingen.id, naam: instellingen.naam })
        .from(instellingen)
        .orderBy(asc(instellingen.naam)),
    ]);

    const isAdmin = deelnemerRow?.idgroep === ADMIN_GROEP_ID;

    // Admins see all active waarneemgroepen; others only those where they are secretaris
    const wgRows = isAdmin
      ? await db
          .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
          .from(waarneemgroepen)
          .where(eq(waarneemgroepen.afgemeld, false))
          .orderBy(asc(waarneemgroepen.naam))
      : await db
          .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
          .from(waarneemgroepen)
          .innerJoin(
            waarneemgroepdeelnemers,
            and(
              eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id),
              eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
              eq(waarneemgroepdeelnemers.idgroep, SECRETARIS_GROEP_ID)
            )
          )
          .where(eq(waarneemgroepen.afgemeld, false))
          .orderBy(asc(waarneemgroepen.naam));

    // Deduplicate (the join can produce multiple rows per group)
    const wgList: WaarneemgroepListItem[] = Array.from(
      new Map(
        wgRows
          .filter((r) => r.id != null && r.naam != null)
          .map((r) => [r.id!, { id: r.id!, naam: r.naam! }])
      ).values()
    );

    // All active waarneemgroepen are used for the "invoegende" dropdown regardless of role
    const allWgRows = isAdmin
      ? wgList
      : await db
          .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
          .from(waarneemgroepen)
          .where(eq(waarneemgroepen.afgemeld, false))
          .orderBy(asc(waarneemgroepen.naam))
          .then((rows) =>
            rows
              .filter((r) => r.id != null && r.naam != null)
              .map((r) => ({ id: r.id!, naam: r.naam! }))
          );

    return res.status(200).json({
      waarneemgroepen: wgList,
      specialismen: specialismenRows
        .filter((r) => r.id != null && r.omschrijving != null)
        .map((r) => ({ id: r.id!, omschrijving: r.omschrijving! })),
      regios: regiosRows
        .filter((r) => r.id != null && r.naam != null)
        .map((r) => ({ id: r.id!, naam: r.naam! })),
      instellingen: instellingenRows
        .filter((r) => r.id != null && r.naam != null)
        .map((r) => ({ id: r.id!, naam: r.naam! })),
      waarneemgroepenForInvoegende: allWgRows,
    });
  } catch (err) {
    console.error('GET /api/waarneemgroep-wijzigen error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
