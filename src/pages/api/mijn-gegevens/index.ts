import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, ne, asc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import { legacyMD5Hash } from '@/lib/legacy-password';
import type {
  MijnGegevensProfile,
  MijnGegevensLookup,
  MijnGegevensUpdateBody,
  MijnGegevensPageData,
  TelnrSlot,
} from '@/types/mijn-gegevens';

const { deelnemers, waarneemgroepen, waarneemgroepdeelnemers, groepen, locaties, instellingtype, settelnrs } = schema;

const LOGIN_MIN = 3;
const LOGIN_MAX = 50;
const PASSWORD_MIN = 3;
const PASSWORD_MAX = 16;
const STRING_MAX = 50;
const POSTCODE_MAX = 10;
const PLAATS_MAX = 40;
const TEL_MAX = 20;

/** Mobiel/Thuis/Maxer have type IDs ≥ 1000 and store no sub-location */
const SPECIAL_TYPE_IDS = new Set([1001, 1003, 1010]);

/** Normalise legacy encoded values like 1000001001 → 1001 */
function normaliseLocatieId(raw: number): number {
  return raw >= 1_000_000_000 ? raw - 1_000_000_000 : raw;
}

/** Validate a Dutch-style phone number (lenient: ≥7 digit-like chars, starts with + or digit) */
const TELNR_VALID = /^\+?[0-9][0-9\s\-]{5,18}[0-9]$/;

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
  res: NextApiResponse<MijnGegevensPageData | { success: true; loginUpdated: boolean } | { error: string }>
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
      // Round 1: deelnemer, instellingtypen, and omschrijvingtelnrs in parallel
      const [deelnemerResult, types, omschrijvingRows] = await Promise.all([
        db
          .select({
            id: deelnemers.id,
            login: deelnemers.login,
            color: deelnemers.color,
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
            callRecording: deelnemers.callRecording,
            idsettelnrdienst: deelnemers.idsettelnrdienst,
          })
          .from(deelnemers)
          .where(eq(deelnemers.id, deelnemerId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select({ id: instellingtype.id, naam: instellingtype.naam })
          .from(instellingtype)
          .where(eq(instellingtype.type, 1)),
        pool
          .query<{ id: number; omschrijving: string }>(
            'SELECT id, omschrijving FROM omschrijvingtelnrs ORDER BY omschrijving'
          )
          .then((r) => r.rows)
          .catch(() => [] as { id: number; omschrijving: string }[]),
      ]);

      const deelnemer = deelnemerResult;
      if (!deelnemer?.id) {
        return res.status(404).json({ error: 'Deelnemer not found' });
      }

      // Round 2: waarneemgroep, groep, locatie, memberships, settelnrs in parallel
      const idloc = deelnemer.idlocatie ?? -1;
      const [waarneemgroepRows, groepRows, locatieRows, membershipRows, settelnrsRow] = await Promise.all([
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
        db
          .select({
            idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep,
            idgroep: waarneemgroepdeelnemers.idgroep,
            naam: waarneemgroepen.naam,
            fte: waarneemgroepdeelnemers.fte,
          })
          .from(waarneemgroepdeelnemers)
          .leftJoin(waarneemgroepen, eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id))
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
              eq(waarneemgroepdeelnemers.aangemeld, true)
            )
          ),
        deelnemer.idsettelnrdienst != null
          ? db
              .select({
                telnr1: settelnrs.telnr1,
                idlocatietelnr1: settelnrs.idlocatietelnr1,
                idomschrtelnr1: settelnrs.idomschrtelnr1,
                smsontvanger1: settelnrs.smsontvanger1,
                telnr2: settelnrs.telnr2,
                idlocatietelnr2: settelnrs.idlocatietelnr2,
                idomschrtelnr2: settelnrs.idomschrtelnr2,
                smsontvanger2: settelnrs.smsontvanger2,
                telnr3: settelnrs.telnr3,
                idlocatietelnr3: settelnrs.idlocatietelnr3,
                idomschrtelnr3: settelnrs.idomschrtelnr3,
                smsontvanger3: settelnrs.smsontvanger3,
                telnr4: settelnrs.telnr4,
                idlocatietelnr4: settelnrs.idlocatietelnr4,
                idomschrtelnr4: settelnrs.idomschrtelnr4,
                smsontvanger4: settelnrs.smsontvanger4,
                telnr5: settelnrs.telnr5,
                idlocatietelnr5: settelnrs.idlocatietelnr5,
                idomschrtelnr5: settelnrs.idomschrtelnr5,
                smsontvanger5: settelnrs.smsontvanger5,
              })
              .from(settelnrs)
              .where(eq(settelnrs.id, deelnemer.idsettelnrdienst))
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null),
      ]);

      const wg = waarneemgroepRows[0];
      const waarneemgroep = wg ? { id: wg.id!, naam: wg.naam } : null;
      const waarneemgroepIdregio = wg?.idregio ?? null;
      const allWaarneemgroepen = membershipRows
        .filter((m) => m.idwaarneemgroep != null)
        .map((m) => ({
          id: m.idwaarneemgroep!,
          naam: m.naam ?? null,
          idgroep: m.idgroep ?? null,
          fte: m.fte != null && Number.isFinite(m.fte) ? m.fte : null,
        }));
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

      // Enrich settelnrs slots
      const rawSlots = settelnrsRow
        ? [
            { telnr: settelnrsRow.telnr1, idloc: settelnrsRow.idlocatietelnr1, idomschr: settelnrsRow.idomschrtelnr1, sms: settelnrsRow.smsontvanger1 },
            { telnr: settelnrsRow.telnr2, idloc: settelnrsRow.idlocatietelnr2, idomschr: settelnrsRow.idomschrtelnr2, sms: settelnrsRow.smsontvanger2 },
            { telnr: settelnrsRow.telnr3, idloc: settelnrsRow.idlocatietelnr3, idomschr: settelnrsRow.idomschrtelnr3, sms: settelnrsRow.smsontvanger3 },
            { telnr: settelnrsRow.telnr4, idloc: settelnrsRow.idlocatietelnr4, idomschr: settelnrsRow.idomschrtelnr4, sms: settelnrsRow.smsontvanger4 },
            { telnr: settelnrsRow.telnr5, idloc: settelnrsRow.idlocatietelnr5, idomschr: settelnrsRow.idomschrtelnr5, sms: settelnrsRow.smsontvanger5 },
          ].filter((s) => s.telnr != null && s.telnr.trim() !== '')
        : [];

      // Batch-fetch real locatie records for slots that store a locaties.id
      const realLocatieIds = rawSlots
        .map((s) => {
          if (s.idloc == null) return null;
          const norm = normaliseLocatieId(s.idloc);
          return SPECIAL_TYPE_IDS.has(norm) ? null : norm;
        })
        .filter((id): id is number => id != null && id > 0);

      const locatieMap = new Map<number, { idinstellingtype: number | null; idregio: number | null }>();
      if (realLocatieIds.length > 0) {
        const locRows = await db
          .select({ id: locaties.id, idinstellingtype: locaties.idinstellingtype, idregio: locaties.idregio })
          .from(locaties)
          .where(inArray(locaties.id, realLocatieIds));
        for (const r of locRows) {
          if (r.id != null) locatieMap.set(r.id, { idinstellingtype: r.idinstellingtype ?? null, idregio: r.idregio ?? null });
        }
      }

      const telnrSlots: TelnrSlot[] = rawSlots.map((s) => {
        const rawId = s.idloc ?? 1001;
        const norm = normaliseLocatieId(rawId);

        if (SPECIAL_TYPE_IDS.has(norm)) {
          return {
            telnr: s.telnr!,
            smsontvanger: s.sms ?? false,
            idInstellingtype: norm,
            idLocatie: null,
            locatieSuffix: 'binnen',
            idomschrtelnr: s.idomschr ?? 2,
          };
        }

        // norm is a locaties.id — look up instellingtype and determine suffix
        const locInfo = locatieMap.get(norm);
        const idInstType = locInfo?.idinstellingtype ?? norm; // fallback: treat as instellingtype id
        const slotIdRegio = locInfo?.idregio ?? null;
        const slotSuffix: 'binnen' | 'buiten' =
          slotIdRegio != null && waarneemgroepIdregio != null && slotIdRegio !== waarneemgroepIdregio
            ? 'buiten'
            : 'binnen';

        return {
          telnr: s.telnr!,
          smsontvanger: s.sms ?? false,
          idInstellingtype: idInstType,
          idLocatie: locInfo ? norm : null,
          locatieSuffix: slotSuffix,
          idomschrtelnr: s.idomschr ?? 2,
        };
      });

      const profile: MijnGegevensProfile = {
        deelnemer: {
          id: deelnemer.id,
          login: deelnemer.login,
          color: deelnemer.color,
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
          callRecording: deelnemer.callRecording,
        },
        waarneemgroep,
        waarneemgroepen: allWaarneemgroepen,
        groep,
        locatie,
        locatieSuffix,
        telnrSlots,
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
        omschrijvingtelnrs: omschrijvingRows,
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

    const geslacht = body.geslacht;
    if (geslacht !== undefined && geslacht !== 0 && geslacht !== 1 && geslacht !== null) {
      return res.status(400).json({ error: 'Ongeldige waarde voor geslacht' });
    }
    const color = body.color;
    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Ongeldige kleurwaarde' });
    }

    const str = (v: unknown, max: number): string | undefined =>
      typeof v === 'string' ? v.slice(0, max) : undefined;
    const update: Record<string, unknown> = {};

    if (color !== undefined) update.color = color;
    if (body.achternaam !== undefined) update.achternaam = str(body.achternaam, STRING_MAX) ?? null;
    if (body.voorletterstussenvoegsel !== undefined)
      update.voorletterstussenvoegsel = str(body.voorletterstussenvoegsel, STRING_MAX) ?? null;
    if (body.voornaam !== undefined) update.voornaam = str(body.voornaam, STRING_MAX) ?? null;
    if (body.initialen !== undefined) update.initialen = str(body.initialen, STRING_MAX) ?? null;
    if (geslacht !== undefined) update.geslacht = geslacht === null ? null : geslacht === 1;
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
    let loginUpdated = false;
    if (body.huisemail !== undefined) {
      const rawEmail = str(body.huisemail, STRING_MAX)?.trim() ?? '';
      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return res.status(400).json({ error: 'Ongeldig e-mailadres' });
      }
      const newEmail = rawEmail || null;
      update.huisemail = newEmail;
      if (newEmail) {
        const [currentDeelnemer] = await db
          .select({ login: deelnemers.login })
          .from(deelnemers)
          .where(eq(deelnemers.id, deelnemerId))
          .limit(1);
        if (currentDeelnemer && currentDeelnemer.login !== newEmail) {
          const [dupe] = await db
            .select({ id: deelnemers.id })
            .from(deelnemers)
            .where(and(eq(deelnemers.login, newEmail), ne(deelnemers.id, deelnemerId)))
            .limit(1);
          if (dupe) {
            return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik als loginnaam' });
          }
          update.login = newEmail;
          loginUpdated = true;
        }
      }
    }
    if (body.echtedeelnemer !== undefined) update.echtedeelnemer = !!body.echtedeelnemer;
    if (body.smsdienstbegin !== undefined) update.smsdienstbegin = !!body.smsdienstbegin;
    if (body.callRecording !== undefined) update.callRecording = !!body.callRecording;

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

    // Handle telnrSlots update
    if (body.waarneemgroepFte !== undefined) {
      const raw = body.waarneemgroepFte;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: 'waarneemgroepFte moet een array zijn' });
      }
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (!row || typeof row !== 'object') {
          return res.status(400).json({ error: `waarneemgroepFte[${i}] is ongeldig` });
        }
        const idwg = (row as { idwaarneemgroep?: unknown }).idwaarneemgroep;
        const fteVal = (row as { fte?: unknown }).fte;
        if (typeof idwg !== 'number' || !Number.isInteger(idwg) || idwg < 1) {
          return res.status(400).json({ error: `Ongeldige waarneemgroep bij FTE-regel ${i + 1}` });
        }
        if (typeof fteVal !== 'number' || !Number.isFinite(fteVal) || fteVal < 0 || fteVal > 2) {
          return res.status(400).json({
            error: `FTE moet tussen 0 en 2 liggen (waarneemgroep ${idwg})`,
          });
        }
      }
      for (const row of raw) {
        const idwg = (row as { idwaarneemgroep: number }).idwaarneemgroep;
        const fteVal = (row as { fte: number }).fte;
        const upd = await db
          .update(waarneemgroepdeelnemers)
          .set({ fte: fteVal })
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
              eq(waarneemgroepdeelnemers.idwaarneemgroep, idwg),
              eq(waarneemgroepdeelnemers.aangemeld, true)
            )
          )
          .returning({ id: waarneemgroepdeelnemers.id });
        if (upd.length === 0) {
          return res.status(403).json({
            error: 'U bent niet aangemeld bij een van de opgegeven waarneemgroepen',
          });
        }
      }
    }

    if (body.telnrSlots !== undefined) {
      const rawSlots = body.telnrSlots;
      if (!Array.isArray(rawSlots) || rawSlots.length > 5) {
        return res.status(400).json({ error: 'telnrSlots moet een array zijn van maximaal 5 items' });
      }

      for (let i = 0; i < rawSlots.length; i++) {
        const slot = rawSlots[i];
        if (!slot || typeof slot !== 'object') {
          return res.status(400).json({ error: `Slot ${i + 1} is ongeldig` });
        }
        const telnr = (slot.telnr ?? '').trim();
        if (!telnr) {
          return res.status(400).json({ error: `Telefoonnummer ${i + 1} mag niet leeg zijn` });
        }
        if (!TELNR_VALID.test(telnr)) {
          return res.status(400).json({ error: `Telefoonnummer ${i + 1} is ongeldig: "${telnr}"` });
        }
        if (typeof slot.idlocatietelnr !== 'number' || slot.idlocatietelnr <= 0) {
          return res.status(400).json({ error: `Locatie voor telefoonnummer ${i + 1} is ongeldig` });
        }
        if (typeof slot.idomschrtelnr !== 'number' || slot.idomschrtelnr < 1 || slot.idomschrtelnr > 6) {
          return res.status(400).json({ error: `Omschrijving voor telefoonnummer ${i + 1} is ongeldig` });
        }
      }

      // Build the 5-slot update object (null-fill unused slots)
      const sSet: Record<string, unknown> = {};
      for (let n = 1; n <= 5; n++) {
        const slot = rawSlots[n - 1];
        sSet[`telnr${n}`] = slot ? slot.telnr.trim().slice(0, TEL_MAX) : null;
        sSet[`smsontvanger${n}`] = slot ? !!slot.smsontvanger : null;
        sSet[`idlocatietelnr${n}`] = slot ? slot.idlocatietelnr : null;
        sSet[`idomschrtelnr${n}`] = slot ? slot.idomschrtelnr : null;
      }

      // Find current idsettelnrdienst (re-fetch to avoid races)
      const [deelnRecord] = await db
        .select({ idsettelnrdienst: deelnemers.idsettelnrdienst })
        .from(deelnemers)
        .where(eq(deelnemers.id, deelnemerId))
        .limit(1);

      const currentSid = deelnRecord?.idsettelnrdienst;

      if (currentSid != null) {
        // Update existing settelnrs record via raw query for reliable dynamic column mapping
        await pool.query(
          `UPDATE settelnrs SET
            telnr1=$1,          idlocatietelnr1=$2,  idomschrtelnr1=$3,  smsontvanger1=$4,
            telnr2=$5,          idlocatietelnr2=$6,  idomschrtelnr2=$7,  smsontvanger2=$8,
            telnr3=$9,          idlocatietelnr3=$10, idomschrtelnr3=$11, smsontvanger3=$12,
            telnr4=$13,         idlocatietelnr4=$14, idomschrtelnr4=$15, smsontvanger4=$16,
            telnr5=$17,         idlocatietelnr5=$18, idomschrtelnr5=$19, smsontvanger5=$20
          WHERE id=$21`,
          [
            sSet.telnr1, sSet.idlocatietelnr1, sSet.idomschrtelnr1, sSet.smsontvanger1,
            sSet.telnr2, sSet.idlocatietelnr2, sSet.idomschrtelnr2, sSet.smsontvanger2,
            sSet.telnr3, sSet.idlocatietelnr3, sSet.idomschrtelnr3, sSet.smsontvanger3,
            sSet.telnr4, sSet.idlocatietelnr4, sSet.idomschrtelnr4, sSet.smsontvanger4,
            sSet.telnr5, sSet.idlocatietelnr5, sSet.idomschrtelnr5, sSet.smsontvanger5,
            currentSid,
          ]
        );
      } else {
        // Create new settelnrs record with next available id
        const idRes = await pool.query<{ newid: number }>(
          'SELECT COALESCE(MAX(id), 0) + 1 AS newid FROM settelnrs'
        );
        const newId = idRes.rows[0].newid;

        await pool.query(
          `INSERT INTO settelnrs (
            id,
            telnr1, idlocatietelnr1, idomschrtelnr1, smsontvanger1,
            telnr2, idlocatietelnr2, idomschrtelnr2, smsontvanger2,
            telnr3, idlocatietelnr3, idomschrtelnr3, smsontvanger3,
            telnr4, idlocatietelnr4, idomschrtelnr4, smsontvanger4,
            telnr5, idlocatietelnr5, idomschrtelnr5, smsontvanger5
          ) VALUES (
            $1,
            $2,  $3,  $4,  $5,
            $6,  $7,  $8,  $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20, $21
          )`,
          [
            newId,
            sSet.telnr1, sSet.idlocatietelnr1, sSet.idomschrtelnr1, sSet.smsontvanger1,
            sSet.telnr2, sSet.idlocatietelnr2, sSet.idomschrtelnr2, sSet.smsontvanger2,
            sSet.telnr3, sSet.idlocatietelnr3, sSet.idomschrtelnr3, sSet.smsontvanger3,
            sSet.telnr4, sSet.idlocatietelnr4, sSet.idomschrtelnr4, sSet.smsontvanger4,
            sSet.telnr5, sSet.idlocatietelnr5, sSet.idomschrtelnr5, sSet.smsontvanger5,
          ]
        );

        // Link to deelnemer
        await db
          .update(deelnemers)
          .set({ idsettelnrdienst: newId })
          .where(eq(deelnemers.id, deelnemerId));
      }
    }

    return res.status(200).json({ success: true, loginUpdated });
  } catch (err) {
    console.error('PATCH /api/mijn-gegevens error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
