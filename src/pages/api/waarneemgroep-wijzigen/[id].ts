import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { GROEP_ADMINISTRATOR, getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import { normalizeDutchPhoneToIntl } from '@/lib/phone-number';
import { getWelkomWavBucket, welkomWelkomstFilePresent } from '@/lib/welkom-wav-s3';

const { waarneemgroepen, deelnemers, waarneemgroepdeelnemers } = schema;

export type WaarneemgroepDetail = {
  id: number;
  naam: string | null;
  idspecialisme: number | null;
  idregio: number | null;
  idinstelling: number | null;
  regiobeschrijving: string | null;
  telnringaand: string | null;
  telnrnietopgenomen: string | null;
  idinvoegendewaarneemgroep: number | null;
  telnronzecentrale: string | null;
  telnrconference: string | null;
  afgemeld: boolean | null;
  smsdienstbegin: boolean | null;
  eigentelwelkomwav: boolean | null;
  eigentelwelkomlocatie: string | null;
  gebruiktVoicemail: boolean | null;
  abomaatschapplanner: boolean | null;
  abbonementDoktersdienst: boolean | null;
  laatstAangemeldDoktersdienst: string | null;
  laastsAfgemeldDoktersidenst: string | null;
  idcoordinatorwaarneemgroep: number | null;
  idliason1: number | null;
  idliason2: number | null;
  idliason3: number | null;
  idliason4: number | null;
};

export type DeelnemerItem = {
  id: number;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
};

export type WaarneemgroepWijzigenShowResponse = {
  waarneemgroep: WaarneemgroepDetail;
  deelnemers: DeelnemerItem[];
  /** True if eigentelwelkomlocatie object exists in S3, or legacy welkom-wg-{id} key exists. */
  welkomWavPresent: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WaarneemgroepWijzigenShowResponse | { success: true } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
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
      const [wgRows, deelnemerRows] = await Promise.all([
        db
          .select({
            id: waarneemgroepen.id,
            naam: waarneemgroepen.naam,
            idspecialisme: waarneemgroepen.idspecialisme,
            idregio: waarneemgroepen.idregio,
            idinstelling: waarneemgroepen.idinstelling,
            regiobeschrijving: waarneemgroepen.regiobeschrijving,
            telnringaand: waarneemgroepen.telnringaand,
            telnrnietopgenomen: waarneemgroepen.telnrnietopgenomen,
            idinvoegendewaarneemgroep: waarneemgroepen.idinvoegendewaarneemgroep,
            telnronzecentrale: waarneemgroepen.telnronzecentrale,
            telnrconference: waarneemgroepen.telnrconference,
            afgemeld: waarneemgroepen.afgemeld,
            smsdienstbegin: waarneemgroepen.smsdienstbegin,
            eigentelwelkomwav: waarneemgroepen.eigentelwelkomwav,
            eigentelwelkomlocatie: waarneemgroepen.eigentelwelkomlocatie,
            gebruiktVoicemail: waarneemgroepen.gebruiktVoicemail,
            abomaatschapplanner: waarneemgroepen.abomaatschapplanner,
            abbonementDoktersdienst: waarneemgroepen.abbonementDoktersdienst,
            laatstAangemeldDoktersdienst: waarneemgroepen.laatstAangemeldDoktersdienst,
            laastsAfgemeldDoktersidenst: waarneemgroepen.laastsAfgemeldDoktersidenst,
            idcoordinatorwaarneemgroep: waarneemgroepen.idcoordinatorwaarneemgroep,
            idliason1: waarneemgroepen.idliason1,
            idliason2: waarneemgroepen.idliason2,
            idliason3: waarneemgroepen.idliason3,
            idliason4: waarneemgroepen.idliason4,
          })
          .from(waarneemgroepen)
          .where(eq(waarneemgroepen.id, id))
          .limit(1),
        db
          .select({
            id: deelnemers.id,
            voornaam: deelnemers.voornaam,
            voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
            achternaam: deelnemers.achternaam,
          })
          .from(deelnemers)
          .innerJoin(
            waarneemgroepdeelnemers,
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, deelnemers.id),
              eq(waarneemgroepdeelnemers.idwaarneemgroep, id),
              eq(waarneemgroepdeelnemers.aangemeld, true)
            )
          )
          .where(eq(deelnemers.afgemeld, false))
          .orderBy(asc(deelnemers.achternaam)),
      ]);

      if (!wgRows[0]) {
        return res.status(404).json({ error: 'Waarneemgroep niet gevonden' });
      }

      let welkomWavPresent = false;
      if (getWelkomWavBucket()) {
        try {
          welkomWavPresent = await welkomWelkomstFilePresent(id, wgRows[0].eigentelwelkomlocatie);
        } catch (headErr) {
          console.error('GET /api/waarneemgroep-wijzigen/[id] welkom wav head', headErr);
          return res.status(503).json({ error: 'Welkomst-audio kon niet worden gecontroleerd.' });
        }
      }

      return res.status(200).json({
        waarneemgroep: wgRows[0] as WaarneemgroepDetail,
        deelnemers: deelnemerRows.filter((d) => d.id != null) as DeelnemerItem[],
        welkomWavPresent,
      });
    } catch (err) {
      console.error('GET /api/waarneemgroep-wijzigen/[id] error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  // PUT
  try {
    const isAdmin = user.idgroep === GROEP_ADMINISTRATOR;
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const [currentRow] = await db
      .select({
        eigentelwelkomwav: waarneemgroepen.eigentelwelkomwav,
        eigentelwelkomlocatie: waarneemgroepen.eigentelwelkomlocatie,
        abbonementDoktersdienst: waarneemgroepen.abbonementDoktersdienst,
      })
      .from(waarneemgroepen)
      .where(eq(waarneemgroepen.id, id))
      .limit(1);

    if (!currentRow) {
      return res.status(404).json({ error: 'Waarneemgroep niet gevonden' });
    }

    const str = (v: unknown, max: number): string | null =>
      typeof v === 'string' ? v.slice(0, max) || null : null;
    const normalizePhoneField = (value: unknown, fieldLabel: string): string | null => {
      const raw = str(value, 50);
      if (!raw) return null;
      const normalized = normalizeDutchPhoneToIntl(raw);
      if (!normalized) {
        throw new Error(`${fieldLabel} is ongeldig. Gebruik bijvoorbeeld 0887732752, 31887732752 of +31887732752.`);
      }
      return normalized;
    };
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '' || v === 0) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const update: Partial<typeof waarneemgroepen.$inferInsert> = {};
    if ('naam' in body) update.naam = str(body.naam, 50);
    if ('idspecialisme' in body) update.idspecialisme = num(body.idspecialisme);
    if ('idregio' in body) update.idregio = num(body.idregio);
    if ('idinstelling' in body) update.idinstelling = num(body.idinstelling);
    if ('regiobeschrijving' in body) update.regiobeschrijving = str(body.regiobeschrijving, 1024);
    if ('telnringaand' in body) update.telnringaand = normalizePhoneField(body.telnringaand, 'Telefoonnummer naar doktersdienst centrale');
    if ('telnrnietopgenomen' in body) update.telnrnietopgenomen = normalizePhoneField(body.telnrnietopgenomen, 'Telefoonnummer achtervang');
    if ('idinvoegendewaarneemgroep' in body) update.idinvoegendewaarneemgroep = num(body.idinvoegendewaarneemgroep);
    if ('telnronzecentrale' in body) {
      const telnronzecentrale = normalizePhoneField(body.telnronzecentrale, 'Telnr onze centrale');
      update.telnronzecentrale = telnronzecentrale;
      update.telnronzecentrale2 = telnronzecentrale;
    }
    if ('telnrconference' in body) update.telnrconference = normalizePhoneField(body.telnrconference, 'Telnr conference');
    if ('afgemeld' in body) update.afgemeld = !!body.afgemeld;
    if ('smsdienstbegin' in body) update.smsdienstbegin = !!body.smsdienstbegin;
    if ('eigentelwelkomwav' in body) update.eigentelwelkomwav = !!body.eigentelwelkomwav;
    if ('gebruiktVoicemail' in body) update.gebruiktVoicemail = !!body.gebruiktVoicemail;
    if ('abomaatschapplanner' in body) update.abomaatschapplanner = !!body.abomaatschapplanner;
    if ('abbonementDoktersdienst' in body) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Alleen een administrator kan het doktersdienst-abonnement aanpassen.' });
      }
      const nextAbbonement = !!body.abbonementDoktersdienst;
      const prevAbbonement = currentRow.abbonementDoktersdienst === true;
      update.abbonementDoktersdienst = nextAbbonement;
      if (nextAbbonement !== prevAbbonement) {
        const nowIso = new Date().toISOString();
        if (nextAbbonement) {
          update.laatstAangemeldDoktersdienst = nowIso;
        } else {
          update.laastsAfgemeldDoktersidenst = nowIso;
        }
      }
    }
    if ('idcoordinatorwaarneemgroep' in body) update.idcoordinatorwaarneemgroep = num(body.idcoordinatorwaarneemgroep);
    if ('idliason1' in body) update.idliason1 = num(body.idliason1);
    if ('idliason2' in body) update.idliason2 = num(body.idliason2);
    if ('idliason3' in body) update.idliason3 = num(body.idliason3);
    if ('idliason4' in body) update.idliason4 = num(body.idliason4);

    const finalEigentelwelkomwav =
      'eigentelwelkomwav' in body ? !!body.eigentelwelkomwav : currentRow.eigentelwelkomwav === true;

    if (finalEigentelwelkomwav) {
      if (!getWelkomWavBucket()) {
        return res.status(503).json({
          error:
            'Eigen welkomstboodschap vereist audio-opslag (S3_WELKOM_BUCKET). Neem contact op met de beheerder.',
        });
      }
      const hasWav = await welkomWelkomstFilePresent(id, currentRow.eigentelwelkomlocatie);
      if (!hasWav) {
        return res.status(400).json({
          error:
            'Voor “Eigen welkomstboodschap” is een audiobestand verplicht. Upload eerst een WAV via de knop hieronder (wordt als .sln opgeslagen; locatie wordt in de database gezet).',
        });
      }
    }

    if (Object.keys(update).length > 0) {
      await db.update(waarneemgroepen).set(update).where(eq(waarneemgroepen.id, id));
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('is ongeldig')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('PUT /api/waarneemgroep-wijzigen/[id] error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
