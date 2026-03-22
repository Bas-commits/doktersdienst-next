import type { NextApiRequest, NextApiResponse } from 'next';
import { asc, eq, max } from 'drizzle-orm';
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

export type SpecialismeItem = { id: number; omschrijving: string };
export type RegioItem = { id: number; naam: string };
export type InstellingItem = { id: number; naam: string };
export type WaarneemgroepListItem = { id: number; naam: string };

export type WaarneemgroepTableItem = {
  id: number;
  naam: string;
  specialisme: string | null;
  regio: string | null;
  telnringaand: string | null;
  idfacturering: number | null;
};

export type WaarneemgroepToevoegenOptions = {
  specialismen: SpecialismeItem[];
  regios: RegioItem[];
  instellingen: InstellingItem[];
  waarneemgroepen: WaarneemgroepListItem[];
  waarneemgroepenTable: WaarneemgroepTableItem[];
};

/** Telefoonnummer: 08800264XX of 318800264XX (laatste twee cijfers variabel) */
export const TELNR_REGEX = /^(08800264[0-9]{2}|318800264[0-9]{2})$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WaarneemgroepToevoegenOptions | { success: true; id: number } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const [specialismenRows, regiosRows, instellingenRows, wgRows] = await Promise.all([
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
        db
          .select({
            id: waarneemgroepen.id,
            naam: waarneemgroepen.naam,
            telnringaand: waarneemgroepen.telnringaand,
            idfacturering: waarneemgroepen.idfacturering,
            specialismeOmschrijving: specialismen.omschrijving,
            regioNaam: regios.naam,
          })
          .from(waarneemgroepen)
          .leftJoin(specialismen, eq(waarneemgroepen.idspecialisme, specialismen.id))
          .leftJoin(regios, eq(waarneemgroepen.idregio, regios.id))
          .where(eq(waarneemgroepen.afgemeld, false))
          .orderBy(asc(waarneemgroepen.naam)),
      ]);

      const activeWgList = wgRows.filter((r) => r.id != null && r.naam != null);

      return res.status(200).json({
        specialismen: specialismenRows
          .filter((r) => r.id != null && r.omschrijving != null)
          .map((r) => ({ id: r.id!, omschrijving: r.omschrijving! })),
        regios: regiosRows
          .filter((r) => r.id != null && r.naam != null)
          .map((r) => ({ id: r.id!, naam: r.naam! })),
        instellingen: instellingenRows
          .filter((r) => r.id != null && r.naam != null)
          .map((r) => ({ id: r.id!, naam: r.naam! })),
        waarneemgroepen: activeWgList.map((r) => ({ id: r.id!, naam: r.naam! })),
        waarneemgroepenTable: activeWgList.map((r) => ({
          id: r.id!,
          naam: r.naam!,
          specialisme: r.specialismeOmschrijving ?? null,
          regio: r.regioNaam ?? null,
          telnringaand: r.telnringaand ?? null,
          idfacturering: r.idfacturering ?? null,
        })),
      });
    } catch (err) {
      console.error('GET /api/waarneemgroep-toevoegen error', err);
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
    if (naam.length > 50) {
      return res.status(400).json({ error: 'Naam mag maximaal 50 tekens zijn.' });
    }

    const telnringaand =
      typeof body.telnringaand === 'string' ? body.telnringaand.trim() || null : null;

    // Validate phone format
    if (telnringaand && !TELNR_REGEX.test(telnringaand)) {
      return res.status(400).json({
        error: 'Het telefoonnummer moet het formaat 08800264XX of 318800264XX hebben.',
      });
    }

    // Check phone uniqueness
    if (telnringaand) {
      const existing = await db
        .select({ id: waarneemgroepen.id })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.telnringaand, telnringaand))
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({
          error: `Telefoonnummer ${telnringaand} is al in gebruik door een andere waarneemgroep.`,
        });
      }
    }

    const str = (v: unknown, maxLen: number): string | null =>
      typeof v === 'string' ? v.slice(0, maxLen) || null : null;
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '' || v === 0) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const [maxRow] = await db.select({ maxId: max(waarneemgroepen.id) }).from(waarneemgroepen);
    const newId = (maxRow?.maxId ?? 0) + 1;

    await db.insert(waarneemgroepen).values({
      id: newId,
      naam,
      idspecialisme: num(body.idspecialisme),
      idregio: num(body.idregio),
      idinstelling: num(body.idinstelling),
      regiobeschrijving: str(body.regiobeschrijving, 1024),
      telnringaand,
      telnrnietopgenomen: str(body.telnrnietopgenomen, 50),
      idinvoegendewaarneemgroep: num(body.idinvoegendewaarneemgroep),
      telnronzecentrale: str(body.telnronzecentrale, 50),
      telnrconference: str(body.telnrconference, 50),
      afgemeld: false,
      smsdienstbegin: !!body.smsdienstbegin,
      eigentelwelkomwav: !!body.eigentelwelkomwav,
      gebruiktVoicemail: !!body.gebruiktVoicemail,
      abomaatschapplanner: !!body.abomaatschapplanner,
    });

    return res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error('POST /api/waarneemgroep-toevoegen error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
