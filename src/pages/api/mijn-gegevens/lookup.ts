import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import type { MijnGegevensLookup } from '@/types/mijn-gegevens';

const { deelnemers, waarneemgroepen, instellingtype, locaties } = schema;

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MijnGegevensLookup | { error: string }>
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
    const [deelnemer] = await db
      .select({ idwaarneemgroep: deelnemers.idwaarneemgroep })
      .from(deelnemers)
      .where(eq(deelnemers.id, deelnemerId))
      .limit(1);

    let idRegio: number | null = null;
    if (deelnemer?.idwaarneemgroep != null) {
      const [wg] = await db
        .select({ idregio: waarneemgroepen.idregio })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.id, deelnemer.idwaarneemgroep))
        .limit(1);
      idRegio = wg?.idregio ?? null;
    }

    const types = await db
      .select({ id: instellingtype.id, naam: instellingtype.naam })
      .from(instellingtype)
      .where(eq(instellingtype.type, 1));

    const locatiesPerTypeBinnen: Record<number, { id: number; naam: string }[]> = {};
    const locatiesPerTypeBuiten: Record<number, { id: number; naam: string }[]> = {};

    for (const t of types) {
      const tid = t.id ?? -1;
      if (tid === -1) continue;

      const binnenRows =
        idRegio != null
          ? await db
              .select({ id: locaties.id, naam: locaties.naam, zoeknaam: locaties.zoeknaam })
              .from(locaties)
              .where(
                and(
                  eq(locaties.idinstellingtype, tid),
                  eq(locaties.idregio, idRegio),
                  eq(locaties.verwijderd, 0)
                )
              )
              .orderBy(asc(locaties.zoeknaam))
          : [];

      const buitenRows = await db
        .select({ id: locaties.id, naam: locaties.naam, zoeknaam: locaties.zoeknaam })
        .from(locaties)
        .where(and(eq(locaties.idinstellingtype, tid), eq(locaties.verwijderd, 0)))
        .orderBy(asc(locaties.zoeknaam));

      const toOption = (r: { id: number | null; naam: string | null }) => ({
        id: r.id ?? -1,
        naam: r.naam ?? 'Geen locaties',
      });

      const binnenOptions = binnenRows.map(toOption);
      if (binnenOptions.length === 0) binnenOptions.push({ id: -1, naam: 'Geen locaties' });
      binnenOptions.push({ id: 0, naam: 'Buiten de regio' });
      locatiesPerTypeBinnen[tid] = binnenOptions;

      const buitenOptions = buitenRows.map(toOption);
      if (buitenOptions.length === 0) buitenOptions.push({ id: -1, naam: 'Geen locaties' });
      buitenOptions.push({ id: 0, naam: 'Binnen de regio' });
      locatiesPerTypeBuiten[tid] = buitenOptions;
    }

    const omschrijvingRows = await pool
      .query<{ id: number; omschrijving: string }>(
        'SELECT id, omschrijving FROM omschrijvingtelnrs ORDER BY omschrijving'
      )
      .then((r) => r.rows)
      .catch(() => [] as { id: number; omschrijving: string }[]);

    const result: MijnGegevensLookup = {
      instellingtypen: types.map((t) => ({ id: t.id ?? -1, naam: t.naam })),
      locatiesPerTypeBinnen,
      locatiesPerTypeBuiten,
      omschrijvingtelnrs: omschrijvingRows,
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/mijn-gegevens/lookup error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
