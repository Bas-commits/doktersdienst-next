import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

const { waarneemgroepen } = schema;

export type WaarneemgroepGegevens = {
  id: number;
  naam: string | null;
  regiobeschrijving: string | null;
  telnringaand: string | null;
  telnrnietopgenomen: string | null;
  telnronzecentrale: string | null;
  smsdienstbegin: boolean | null;
  gebruiktVoicemail: boolean | null;
  eigentelwelkomwav: boolean | null;
  abomaatschapplanner: boolean | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ waarneemgroep: WaarneemgroepGegevens } | { success: true } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = Number(req.query.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const hasAccess = await hasGroupManagementAccess(user, id);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
  }

  if (req.method === 'GET') {
    try {
      const [wg] = await db
        .select({
          id: waarneemgroepen.id,
          naam: waarneemgroepen.naam,
          regiobeschrijving: waarneemgroepen.regiobeschrijving,
          telnringaand: waarneemgroepen.telnringaand,
          telnrnietopgenomen: waarneemgroepen.telnrnietopgenomen,
          telnronzecentrale: waarneemgroepen.telnronzecentrale,
          smsdienstbegin: waarneemgroepen.smsdienstbegin,
          gebruiktVoicemail: waarneemgroepen.gebruiktVoicemail,
          eigentelwelkomwav: waarneemgroepen.eigentelwelkomwav,
          abomaatschapplanner: waarneemgroepen.abomaatschapplanner,
        })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.id, id))
        .limit(1);

      if (!wg) {
        return res.status(404).json({ error: 'Waarneemgroep niet gevonden' });
      }

      return res.status(200).json({ waarneemgroep: wg as WaarneemgroepGegevens });
    } catch (err) {
      console.error('GET /api/waarneemgroep-gegevens error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  // PATCH
  const body = req.body as Partial<Omit<WaarneemgroepGegevens, 'id' | 'telnronzecentrale'>>;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be an object' });
  }

  try {
    const update: Record<string, unknown> = {};
    if (body.naam !== undefined) update.naam = String(body.naam).slice(0, 50) || null;
    if (body.regiobeschrijving !== undefined) update.regiobeschrijving = String(body.regiobeschrijving).slice(0, 1024) || null;
    if (body.telnringaand !== undefined) update.telnringaand = String(body.telnringaand).slice(0, 50) || null;
    if (body.telnrnietopgenomen !== undefined) update.telnrnietopgenomen = String(body.telnrnietopgenomen).slice(0, 50) || null;
    if (body.smsdienstbegin !== undefined) update.smsdienstbegin = !!body.smsdienstbegin;
    if (body.gebruiktVoicemail !== undefined) update.gebruiktVoicemail = !!body.gebruiktVoicemail;
    if (body.eigentelwelkomwav !== undefined) update.eigentelwelkomwav = !!body.eigentelwelkomwav;
    if (body.abomaatschapplanner !== undefined) update.abomaatschapplanner = !!body.abomaatschapplanner;

    if (Object.keys(update).length > 0) {
      await db.update(waarneemgroepen).set(update as any).where(eq(waarneemgroepen.id, id));
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/waarneemgroep-gegevens error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
