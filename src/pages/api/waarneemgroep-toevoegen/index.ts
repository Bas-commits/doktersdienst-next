import type { NextApiRequest, NextApiResponse } from 'next';
import { asc, eq, max, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  normalizeTelnrRingaandKey,
} from '@/lib/waarneemgroep-telnringaand';
import { normalizeDutchPhoneToIntl } from '@/lib/phone-number';

const { waarneemgroepen, specialismen, regios, instellingen } = schema;

export type SpecialismeItem = { id: number; omschrijving: string };
export type RegioItem = { id: number; naam: string };
export type InstellingItem = { id: number; naam: string };
export type WaarneemgroepListItem = { id: number; naam: string };

export type WaarneemgroepTableItem = {
  id: number;
  naam: string;
  specialisme: string | null;
  regio: string | null;
  telnronzecentrale: string | null;
  idfacturering: number | null;
};

export type WaarneemgroepToevoegenOptions = {
  specialismen: SpecialismeItem[];
  regios: RegioItem[];
  instellingen: InstellingItem[];
  waarneemgroepen: WaarneemgroepListItem[];
  waarneemgroepenTable: WaarneemgroepTableItem[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WaarneemgroepToevoegenOptions | { success: true; id: number } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST' && !user.isAdmin) {
    return res.status(403).json({ error: 'Alleen administrators kunnen waarneemgroepen toevoegen.' });
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
            telnronzecentrale: waarneemgroepen.telnronzecentrale,
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
          telnronzecentrale: r.telnronzecentrale ?? null,
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

    const normalizePhoneField = (value: unknown, fieldLabel: string): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const normalized = normalizeDutchPhoneToIntl(trimmed);
      if (!normalized) {
        throw new Error(`${fieldLabel} is ongeldig. Gebruik bijvoorbeeld 0887732752, 31887732752 of +31887732752.`);
      }
      return normalized;
    };

    const selectedTelnronzecentrale =
      typeof body.telnronzecentrale2 === 'string'
        ? body.telnronzecentrale2.trim() || null
        : typeof body.telnronzecentrale === 'string'
          ? body.telnronzecentrale.trim() || null
          : null;
    const telnronzecentrale2 = selectedTelnronzecentrale
      ? normalizePhoneField(selectedTelnronzecentrale, 'Telefoonnummer centrale')
      : null;
    const telnronzecentrale = telnronzecentrale2;
    const telnringaand = normalizePhoneField(body.telnringaand, 'Telefoonnummer naar doktersdienst centrale');
    const telnrnietopgenomen = normalizePhoneField(body.telnrnietopgenomen, 'Telefoonnummer achtervang');
    const telnrconference = normalizePhoneField(body.telnrconference, 'Telnr conference');

    // Check phone uniqueness across common stored formats.
    if (telnronzecentrale2) {
      const canonicalKey = telnronzecentrale2!;
      const nationalForm = `0${canonicalKey.slice(2)}`;
      const plusForm = `+${canonicalKey}`;
      const legacyRingaandKey = normalizeTelnrRingaandKey(telnronzecentrale2);
      const existing = await db
        .select({ id: waarneemgroepen.id })
        .from(waarneemgroepen)
        .where(
          or(
            eq(waarneemgroepen.telnronzecentrale2, canonicalKey),
            eq(waarneemgroepen.telnronzecentrale, canonicalKey),
            eq(waarneemgroepen.telnronzecentrale, nationalForm),
            eq(waarneemgroepen.telnronzecentrale, plusForm),
            ...(legacyRingaandKey ? [eq(waarneemgroepen.telnronzecentrale2, legacyRingaandKey)] : [])
          )
        )
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({
          error: `Telefoonnummer ${telnronzecentrale2} is al in gebruik door een andere waarneemgroep.`,
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
      telnrnietopgenomen,
      idinvoegendewaarneemgroep: num(body.idinvoegendewaarneemgroep),
      telnronzecentrale,
      telnronzecentrale2,
      telnrconference,
      afgemeld: false,
      smsdienstbegin: !!body.smsdienstbegin,
      eigentelwelkomwav: !!body.eigentelwelkomwav,
      gebruiktVoicemail: !!body.gebruiktVoicemail,
      abomaatschapplanner: !!body.abomaatschapplanner,
    });

    return res.status(201).json({ success: true, id: newId });
  } catch (err) {
    if (err instanceof Error && err.message.includes('is ongeldig')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /api/waarneemgroep-toevoegen error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
