import type { NextApiRequest, NextApiResponse } from 'next';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { waarneemgroepen, specialismen, regios, instellingen } = schema;

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

  try {
    const [wgRows, specialismenRows, regiosRows, instellingenRows] = await Promise.all([
      db
        .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.afgemeld, false))
        .orderBy(asc(waarneemgroepen.naam)),
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

    const wgList: WaarneemgroepListItem[] = wgRows
      .filter((r) => r.id != null && r.naam != null)
      .map((r) => ({ id: r.id!, naam: r.naam! }));

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
      waarneemgroepenForInvoegende: wgList,
    });
  } catch (err) {
    console.error('GET /api/waarneemgroep-wijzigen error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
