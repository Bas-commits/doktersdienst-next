import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, ne, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import { legacyMD5Hash } from '@/lib/legacy-password';
import type {
  MijnGegevensProfile,
  MijnGegevensLookup,
  MijnGegevensUpdateBody,
  MijnGegevensPageData,
} from '@/types/mijn-gegevens';

const { deelnemers, waarneemgroepen, groepen, locaties, instellingtype } = schema;

const LOGIN_MIN = 3;
const LOGIN_MAX = 50;
const PASSWORD_MIN = 3;
const PASSWORD_MAX = 16;
const STRING_MAX = 50;
const POSTCODE_MAX = 10;
const PLAATS_MAX = 40;
const TEL_MAX = 20;

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
  res: NextApiResponse<MijnGegevensPageData | { success: true } | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
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

  if (req.method === 'GET') {
    try {
      // Round 1: deelnemer and instellingtypen in parallel (no dependency)
      const [deelnemerResult, types] = await Promise.all([
        db
          .select({
            id: deelnemers.id,
            login: deelnemers.login,
            achternaam: deelnemers.achternaam,
            voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
            voornaam: deelnemers.voornaam,
            initialen: deelnemers.initialen,
            geslacht: deelnemers.geslacht,
            idlocatie: deelnemers.idlocatie,
            idwaarneemgroep: deelnemers.idwaarneemgroep,
            idgroep: deelnemers.idgroep,
            huisadrstraatnr: deelnemers.huisadrstraatnr,
            huisadrpostcode: deelnemers.huisadrpostcode,
            huisadrplaats: deelnemers.huisadrplaats,
            huisadrtelnr: deelnemers.huisadrtelnr,
            huisadrfax: deelnemers.huisadrfax,
            huisemail: deelnemers.huisemail,
            echtedeelnemer: deelnemers.echtedeelnemer,
            smsdienstbegin: deelnemers.smsdienstbegin,
          })
          .from(deelnemers)
          .where(eq(deelnemers.id, deelnemerId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select({ id: instellingtype.id, naam: instellingtype.naam })
          .from(instellingtype)
          .where(eq(instellingtype.type, 1)),
      ]);

      const deelnemer = deelnemerResult;
      if (!deelnemer?.id) {
        return res.status(404).json({ error: 'Deelnemer not found' });
      }

      // Round 2: waarneemgroep, groep, locatie in parallel (all depend only on deelnemer)
      const idloc = deelnemer.idlocatie ?? -1;
      const [waarneemgroepRows, groepRows, locatieRows] = await Promise.all([
        deelnemer.idwaarneemgroep != null
          ? db
              .select({
                id: waarneemgroepen.id,
                naam: waarneemgroepen.naam,
                idregio: waarneemgroepen.idregio,
              })
              .from(waarneemgroepen)
              .where(eq(waarneemgroepen.id, deelnemer.idwaarneemgroep))
              .limit(1)
          : Promise.resolve([]),
        deelnemer.idgroep != null
          ? db.select({ id: groepen.id }).from(groepen).where(eq(groepen.id, deelnemer.idgroep)).limit(1)
          : Promise.resolve([]),
        idloc !== -1 && idloc !== 0
          ? db
              .select({
                id: locaties.id,
                idinstellingtype: locaties.idinstellingtype,
                idregio: locaties.idregio,
              })
              .from(locaties)
              .where(eq(locaties.id, idloc))
              .limit(1)
          : Promise.resolve([]),
      ]);

      const wg = waarneemgroepRows[0];
      const waarneemgroep = wg ? { id: wg.id!, naam: wg.naam } : null;
      const waarneemgroepIdregio = wg?.idregio ?? null;
      const groep = groepRows[0]?.id != null ? { id: groepRows[0].id } : null;
      const locRow = locatieRows[0];
      const locatie =
        locRow?.id != null
          ? {
              id: locRow.id,
              idinstellingtype: locRow.idinstellingtype ?? null,
              idregio: locRow.idregio ?? null,
            }
          : null;

      let locatieSuffix: 'binnen' | 'buiten' = 'binnen';
      if (
        locatie &&
        waarneemgroepIdregio != null &&
        locatie.idregio != null &&
        locatie.idregio !== waarneemgroepIdregio &&
        (locatie.idinstellingtype ?? 0) < 1000 &&
        locatie.id !== -1
      ) {
        locatieSuffix = 'buiten';
      }

      const profile: MijnGegevensProfile = {
        deelnemer: {
          id: deelnemer.id,
          login: deelnemer.login,
          achternaam: deelnemer.achternaam,
          voorletterstussenvoegsel: deelnemer.voorletterstussenvoegsel,
          voornaam: deelnemer.voornaam,
          initialen: deelnemer.initialen,
          geslacht: deelnemer.geslacht,
          idlocatie: deelnemer.idlocatie,
          huisadrstraatnr: deelnemer.huisadrstraatnr,
          huisadrpostcode: deelnemer.huisadrpostcode,
          huisadrplaats: deelnemer.huisadrplaats,
          huisadrtelnr: deelnemer.huisadrtelnr,
          huisadrfax: deelnemer.huisadrfax,
          huisemail: deelnemer.huisemail,
          echtedeelnemer: deelnemer.echtedeelnemer,
          smsdienstbegin: deelnemer.smsdienstbegin,
        },
        waarneemgroep,
        groep,
        locatie,
        locatieSuffix,
      };

      // Round 3: all locatie lists per type in parallel (depend on types + idRegio)
      const toOption = (r: { id: number | null; naam: string | null }) => ({
        id: r.id ?? -1,
        naam: r.naam ?? 'Geen locaties',
      });
      const locatiesPerTypeBinnen: Record<number, { id: number; naam: string }[]> = {};
      const locatiesPerTypeBuiten: Record<number, { id: number; naam: string }[]> = {};

      const locatiePromises = types.flatMap((t) => {
        const tid = t.id ?? -1;
        if (tid === -1) return [];
        return [
          waarneemgroepIdregio != null
            ? db
                .select({ id: locaties.id, naam: locaties.naam })
                .from(locaties)
                .where(
                  and(
                    eq(locaties.idinstellingtype, tid),
                    eq(locaties.idregio, waarneemgroepIdregio),
                    eq(locaties.verwijderd, 0)
                  )
                )
                .orderBy(asc(locaties.zoeknaam))
                .then((rows) => {
                  const opts = rows.map(toOption);
                  if (opts.length === 0) opts.push({ id: -1, naam: 'Geen locaties' });
                  opts.push({ id: 0, naam: 'Buiten de regio' });
                  locatiesPerTypeBinnen[tid] = opts;
                })
            : Promise.resolve().then(() => {
                locatiesPerTypeBinnen[tid] = [
                  { id: -1, naam: 'Geen locaties' },
                  { id: 0, naam: 'Buiten de regio' },
                ];
              }),
          db
            .select({ id: locaties.id, naam: locaties.naam })
            .from(locaties)
            .where(and(eq(locaties.idinstellingtype, tid), eq(locaties.verwijderd, 0)))
            .orderBy(asc(locaties.zoeknaam))
            .then((rows) => {
              const opts = rows.map(toOption);
              if (opts.length === 0) opts.push({ id: -1, naam: 'Geen locaties' });
              opts.push({ id: 0, naam: 'Binnen de regio' });
              locatiesPerTypeBuiten[tid] = opts;
            }),
        ];
      });

      await Promise.all(locatiePromises);

      const lookup: MijnGegevensLookup = {
        instellingtypen: types.map((t) => ({ id: t.id ?? -1, naam: t.naam })),
        locatiesPerTypeBinnen,
        locatiesPerTypeBuiten,
      };

      const pageData: MijnGegevensPageData = { profile, lookup };
      return res.status(200).json(pageData);
    } catch (err) {
      console.error('GET /api/mijn-gegevens error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // PATCH
  const body = req.body as MijnGegevensUpdateBody;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be an object' });
  }

  try {
    const passa = typeof body.passa === 'string' ? body.passa : undefined;
    const passb = typeof body.passb === 'string' ? body.passb : undefined;
    if (passa !== undefined && passb !== undefined) {
      if (passa !== passb) {
        return res.status(400).json({ error: 'Nieuw password en herhaling komen niet overeen' });
      }
      if (passa.length < PASSWORD_MIN || passa.length > PASSWORD_MAX) {
        return res.status(400).json({
          error: `Nieuw password moet tussen ${PASSWORD_MIN} en ${PASSWORD_MAX} tekens zijn`,
        });
      }
    }

    const login =
      typeof body.login === 'string' && body.login.trim().length > 0
        ? body.login.trim()
        : undefined;
    if (login !== undefined) {
      if (login.length < LOGIN_MIN || login.length > LOGIN_MAX) {
        return res.status(400).json({
          error: `Login moet tussen ${LOGIN_MIN} en ${LOGIN_MAX} tekens zijn`,
        });
      }
      const [dupe] = await db
        .select({ id: deelnemers.id })
        .from(deelnemers)
        .where(and(eq(deelnemers.login, login), ne(deelnemers.id, deelnemerId)))
        .limit(1);
      if (dupe) {
        return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik' });
      }
    }

    const geslacht = body.geslacht;
    if (geslacht !== undefined && geslacht !== 0 && geslacht !== 1) {
      return res.status(400).json({ error: 'Ongeldige waarde voor geslacht' });
    }

    const str = (v: unknown, max: number): string | undefined =>
      typeof v === 'string' ? v.slice(0, max) : undefined;
    const update: Record<string, unknown> = {};

    if (body.achternaam !== undefined) update.achternaam = str(body.achternaam, STRING_MAX) ?? null;
    if (body.voorletterstussenvoegsel !== undefined)
      update.voorletterstussenvoegsel = str(body.voorletterstussenvoegsel, STRING_MAX) ?? null;
    if (body.voornaam !== undefined) update.voornaam = str(body.voornaam, STRING_MAX) ?? null;
    if (body.initialen !== undefined) update.initialen = str(body.initialen, STRING_MAX) ?? null;
    if (geslacht !== undefined) update.geslacht = geslacht === 1;
    if (body.idlocatie !== undefined) update.idlocatie = body.idlocatie;
    if (body.huisadrstraatnr !== undefined)
      update.huisadrstraatnr = str(body.huisadrstraatnr, STRING_MAX) ?? null;
    if (body.huisadrpostcode !== undefined)
      update.huisadrpostcode = str(body.huisadrpostcode, POSTCODE_MAX) ?? null;
    if (body.huisadrplaats !== undefined)
      update.huisadrplaats = str(body.huisadrplaats, PLAATS_MAX) ?? null;
    if (body.huisadrtelnr !== undefined)
      update.huisadrtelnr = str(body.huisadrtelnr, TEL_MAX) ?? null;
    if (body.huisadrfax !== undefined)
      update.huisadrfax = str(body.huisadrfax, TEL_MAX) ?? null;
    if (body.huisemail !== undefined)
      update.huisemail = str(body.huisemail, STRING_MAX) ?? null;
    if (body.echtedeelnemer !== undefined) update.echtedeelnemer = !!body.echtedeelnemer;
    if (body.smsdienstbegin !== undefined) update.smsdienstbegin = !!body.smsdienstbegin;
    if (login !== undefined) update.login = login;

    let newEncryptedPassword: string | null = null;
    if (passa !== undefined && passb !== undefined && passa === passb) {
      newEncryptedPassword = legacyMD5Hash(passa);
      (update as Record<string, string>).encryptedPassword = newEncryptedPassword;
    }

    if (Object.keys(update).length > 0) {
      await db.update(deelnemers).set(update as any).where(eq(deelnemers.id, deelnemerId));
    }

    if (newEncryptedPassword !== null) {
      const accountId = `credential-${deelnemerId}`;
      await pool.query(
        `UPDATE account SET password = $1, "updatedAt" = now() WHERE id = $2`,
        [newEncryptedPassword, accountId]
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/mijn-gegevens error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
