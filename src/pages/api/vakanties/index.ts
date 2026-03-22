import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, lt, max } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { vakanties, vakantieregios } = schema;

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export type VakantieRegioItem = { id: number; naam: string };

export type VakantieItem = {
  id: number;
  naam: string;
  idvakantieregio: number | null;
  regio_naam: string | null;
  van: number;
  tot: number;
  type: number;
};

export type VakantiesResponse = {
  vakantieregios: VakantieRegioItem[];
  vakanties: VakantieItem[];
  year: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VakantiesResponse | { success: true; id: number } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const year = Number(req.query.year) || new Date().getFullYear();
    const yearStart = Math.floor(new Date(year, 0, 1).getTime() / 1000);
    const yearEnd = Math.floor(new Date(year + 1, 0, 1).getTime() / 1000);

    try {
      const [regioRows, vakantieRows] = await Promise.all([
        db
          .select({ id: vakantieregios.id, naam: vakantieregios.naam })
          .from(vakantieregios)
          .orderBy(asc(vakantieregios.naam)),
        db
          .select({
            id: vakanties.id,
            naam: vakanties.naam,
            idvakantieregio: vakanties.idvakantieregio,
            regioNaam: vakantieregios.naam,
            van: vakanties.van,
            tot: vakanties.tot,
            type: vakanties.type,
          })
          .from(vakanties)
          .leftJoin(vakantieregios, eq(vakanties.idvakantieregio, vakantieregios.id))
          .where(and(gte(vakanties.van, yearStart), lt(vakanties.van, yearEnd)))
          .orderBy(asc(vakanties.van)),
      ]);

      return res.status(200).json({
        vakantieregios: regioRows
          .filter((r) => r.id != null && r.naam != null)
          .map((r) => ({ id: r.id!, naam: r.naam! })),
        vakanties: vakantieRows
          .filter((r) => r.id != null && r.naam != null && r.van != null && r.tot != null)
          .map((r) => ({
            id: r.id!,
            naam: r.naam!,
            idvakantieregio: r.idvakantieregio ?? null,
            regio_naam: r.regioNaam ?? null,
            van: r.van!,
            tot: r.tot!,
            type: r.type ?? 1,
          })),
        year,
      });
    } catch (err) {
      console.error('GET /api/vakanties error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  // POST
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const naam = typeof body.naam === 'string' ? body.naam.trim() : '';
    if (!naam) {
      return res.status(400).json({ error: 'Naam is verplicht.' });
    }

    const van = Number(body.van);
    const tot = Number(body.tot);
    if (!Number.isFinite(van) || van <= 0) {
      return res.status(400).json({ error: 'Ongeldige Van-datum.' });
    }
    if (!Number.isFinite(tot) || tot <= 0) {
      return res.status(400).json({ error: 'Ongeldige Tot-datum.' });
    }
    if (tot < van) {
      return res.status(400).json({ error: 'Tot moet na Van liggen.' });
    }

    const typeVal = Number(body.type);
    const type = typeVal === 0 ? 0 : 1;

    const idvakantieregio = Number(body.idvakantieregio) || null;

    const [maxRow] = await db.select({ maxId: max(vakanties.id) }).from(vakanties);
    const newId = (maxRow?.maxId ?? 0) + 1;

    await db.insert(vakanties).values({
      id: newId,
      naam,
      idvakantieregio: idvakantieregio && idvakantieregio > 0 ? idvakantieregio : null,
      van,
      tot,
      type,
    });

    return res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error('POST /api/vakanties error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
