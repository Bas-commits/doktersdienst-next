import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, ne, asc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import { legacyMD5Hash } from '@/lib/legacy-password';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { hasDelegatedProfileAccess, canEditEchtedeelnemer } from '@/lib/mijn-gegevens-access';
import { normalizeAccountEmail } from '@/lib/account-email-tokens';
import {
  BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST,
  BEHEERDER_WIJZIGT_ANDERMANS_WACHTWOORD_TEKST,
} from '@/lib/beheerder-contact';
import {
  resolveStoredCredentialHash,
  verifyStoredCredentialHash,
} from '@/lib/legacy-credential';
import { getStrongPasswordError } from '@/lib/password-policy';
import { normalizeDutchPhoneToIntl } from '@/lib/phone-number';
import type {
  MijnGegevensProfile,
  MijnGegevensLookup,
  MijnGegevensUpdateBody,
  MijnGegevensPageData,
  TelnrSlot,
} from '@/types/mijn-gegevens';

const {
  deelnemers,
  waarneemgroepen,
  waarneemgroepdeelnemers,
  groepen,
  locaties,
  instellingtype,
  settelnrs,
  expertises,
  deelnemerexpertises,
} = schema;

const LOGIN_MIN = 3;
const LOGIN_MAX = 50;
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

const GELDIGE_WAARNEEMGROEP_FUNCTIES = new Set([1, 2, 3, 4]);

/**
 * Controleert het meegestuurde huidige wachtwoord tegen de opgeslagen hash.
 *
 * Geeft null terug als het klopt, anders het antwoord dat de route moet sturen.
 * Wie nog nooit een wachtwoord heeft gezet kan hier niets bewijzen en wordt naar
 * de resetlink gestuurd. Zou een leeg veld hier slagen, dan was het juist bij de
 * accounts zonder wachtwoord dat iedereen langs de controle liep.
 */
async function controleerHuidigWachtwoord(
  deelnemerId: number,
  ingevuld: unknown
): Promise<{ status: number; error: string } | null> {
  const plain = typeof ingevuld === 'string' ? ingevuld : '';
  if (!plain) {
    return { status: 400, error: 'Vul uw huidige wachtwoord in' };
  }

  const [row] = await db
    .select({
      encryptedPassword: deelnemers.encryptedPassword,
      password: deelnemers.password,
    })
    .from(deelnemers)
    .where(eq(deelnemers.id, deelnemerId))
    .limit(1);

  const hash = row
    ? resolveStoredCredentialHash({
        encrypted_password: row.encryptedPassword,
        password: row.password,
      })
    : null;
  if (!hash) {
    return {
      status: 400,
      error:
        'Er staat nog geen wachtwoord op dit account. Gebruik "wachtwoord vergeten" op de inlogpagina om er een te kiezen.',
    };
  }

  if (!(await verifyStoredCredentialHash(hash, plain))) {
    return { status: 403, error: 'Uw huidige wachtwoord klopt niet' };
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | MijnGegevensPageData
    | { success: true; loginUpdated: boolean }
    | { error: string; code?: string }
  >
) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getAuthenticatedUser(req);
  if (!actor) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rawTargetId = Array.isArray(req.query.deelnemerId)
    ? req.query.deelnemerId[0]
    : req.query.deelnemerId;
  const targetDeelnemerId = rawTargetId ? Number(rawTargetId) : actor.id;
  if (!Number.isInteger(targetDeelnemerId) || targetDeelnemerId < 1) {
    return res.status(400).json({ error: 'Invalid deelnemerId' });
  }

  const isDelegatedEdit = targetDeelnemerId !== actor.id;
  if (isDelegatedEdit) {
    const hasAccess = await hasDelegatedProfileAccess(actor, targetDeelnemerId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Geen toegang tot deze deelnemer' });
    }
  }

  const mayEditEchtedeelnemer = await canEditEchtedeelnemer(actor, targetDeelnemerId, isDelegatedEdit);

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
            emailVerified: deelnemers.emailVerified,
          })
          .from(deelnemers)
          .where(eq(deelnemers.id, targetDeelnemerId))
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
            idfunctie: waarneemgroepdeelnemers.idfunctie,
          })
          .from(waarneemgroepdeelnemers)
          .leftJoin(waarneemgroepen, eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id))
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, targetDeelnemerId),
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
      const membershipWgIds = membershipRows
        .map((m) => m.idwaarneemgroep)
        .filter((id): id is number => id != null);

      const [expertiseCatalogRows, selectedExpertiseRows] = await Promise.all([
        membershipWgIds.length > 0
          ? db
              .select({
                id: expertises.id,
                naam: expertises.naam,
                afkorting: expertises.afkorting,
                idwaarneemgroep: expertises.idwaarneemgroep,
                actief: expertises.actief,
              })
              .from(expertises)
              .where(inArray(expertises.idwaarneemgroep, membershipWgIds))
              .orderBy(asc(expertises.naam))
          : Promise.resolve([]),
        db
          .select({
            idexpertise: deelnemerexpertises.idexpertise,
            idwaarneemgroep: expertises.idwaarneemgroep,
            naam: expertises.naam,
            afkorting: expertises.afkorting,
            actief: expertises.actief,
          })
          .from(deelnemerexpertises)
          .innerJoin(expertises, eq(deelnemerexpertises.idexpertise, expertises.id))
          .where(eq(deelnemerexpertises.iddeelnemer, targetDeelnemerId)),
      ]);

      const selectedByWg = new Map<number, number[]>();
      const selectedInactiveByWg = new Map<
        number,
        { id: number; naam: string; afkorting: string | null }[]
      >();
      for (const row of selectedExpertiseRows) {
        if (row.idwaarneemgroep == null || row.idexpertise == null) continue;
        const list = selectedByWg.get(row.idwaarneemgroep) ?? [];
        list.push(row.idexpertise);
        selectedByWg.set(row.idwaarneemgroep, list);
        if (!row.actief) {
          const inactive = selectedInactiveByWg.get(row.idwaarneemgroep) ?? [];
          inactive.push({
            id: row.idexpertise,
            naam: row.naam,
            afkorting: row.afkorting ?? null,
          });
          selectedInactiveByWg.set(row.idwaarneemgroep, inactive);
        }
      }

      const activeExpertisesByWg = new Map<
        number,
        { id: number; naam: string; afkorting: string | null }[]
      >();
      for (const row of expertiseCatalogRows) {
        if (!row.actief) continue;
        const list = activeExpertisesByWg.get(row.idwaarneemgroep) ?? [];
        list.push({
          id: row.id,
          naam: row.naam,
          afkorting: row.afkorting ?? null,
        });
        activeExpertisesByWg.set(row.idwaarneemgroep, list);
      }

      const allWaarneemgroepen = membershipRows
        .filter((m) => m.idwaarneemgroep != null)
        .map((m) => {
          const wgId = m.idwaarneemgroep!;
          const active = activeExpertisesByWg.get(wgId) ?? [];
          const inactiveSelected = selectedInactiveByWg.get(wgId) ?? [];
          const seen = new Set(active.map((e) => e.id));
          const expertisesForWg = [
            ...active,
            ...inactiveSelected.filter((e) => {
              if (seen.has(e.id)) return false;
              seen.add(e.id);
              return true;
            }),
          ];
          return {
            id: wgId,
            naam: m.naam ?? null,
            idgroep: m.idgroep ?? null,
            fte: m.fte != null && Number.isFinite(m.fte) ? m.fte : null,
            idfunctie:
              m.idfunctie != null && GELDIGE_WAARNEEMGROEP_FUNCTIES.has(m.idfunctie)
                ? m.idfunctie
                : null,
            expertises: expertisesForWg,
            selectedExpertiseIds: selectedByWg.get(wgId) ?? [],
          };
        });
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

      const pageData: MijnGegevensPageData = {
        profile,
        lookup,
        isDelegatedEdit,
        canEditEchtedeelnemer: mayEditEchtedeelnemer,
        canEditEmail: !isDelegatedEdit || actor.isAdmin,
        canEditPassword: !isDelegatedEdit || actor.isAdmin,
        requiresCurrentPassword: !isDelegatedEdit,
        emailVerified: deelnemer.emailVerified ?? null,
        targetDeelnemerId,
        actingDeelnemerId: actor.id,
      };
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

    if (body.passa !== undefined || body.passb !== undefined) {
      // Het scherm toont de knop Wijzig wachtwoord alleen waar het mag, maar dat
      // is presentatie. De weigering hoort hier.
      if (isDelegatedEdit && !actor.isAdmin) {
        return res.status(403).json({ error: BEHEERDER_WIJZIGT_ANDERMANS_WACHTWOORD_TEKST });
      }
      if (passa === undefined || passb === undefined) {
        return res.status(400).json({ error: 'Vul het nieuwe wachtwoord twee keer in' });
      }
      if (passa !== passb) {
        return res.status(400).json({ error: 'Nieuw password en herhaling komen niet overeen' });
      }
      const regelFout = getStrongPasswordError(passa);
      if (regelFout) {
        return res.status(400).json({ error: regelFout });
      }
      // Op je eigen account is het huidige wachtwoord het bewijs dat jij het bent
      // en niet iemand die je scherm open aantrof. De beheerder die een ander
      // helpt kan dat wachtwoord niet weten: dat is juist waarom hij gebeld wordt.
      if (!isDelegatedEdit) {
        const fout = await controleerHuidigWachtwoord(targetDeelnemerId, body.huidigWachtwoord);
        if (fout) {
          return res.status(fout.status).json({ error: fout.error });
        }
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
    const normalizeOptionalPhone = (value: unknown, fieldLabel: string): string | null => {
      if (typeof value !== 'string') return null;
      const clipped = value.slice(0, TEL_MAX).trim();
      if (!clipped) return null;
      const normalized = normalizeDutchPhoneToIntl(clipped);
      if (!normalized) {
        throw new Error(`${fieldLabel} is ongeldig. Gebruik bijvoorbeeld 0612345678, 31612345678 of +31612345678.`);
      }
      return normalized;
    };
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
    if (body.huisadrtelnr !== undefined) {
      update.huisadrtelnr = normalizeOptionalPhone(body.huisadrtelnr, 'Telefoonnummer');
    }
    if (body.huisadrfax !== undefined) {
      update.huisadrfax = normalizeOptionalPhone(body.huisadrfax, 'Faxnummer');
    }
    let loginUpdated = false;
    if (body.huisemail !== undefined) {
      const rawEmail = str(body.huisemail, STRING_MAX)?.trim() ?? '';
      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return res.status(400).json({ error: 'Ongeldig e-mailadres' });
      }
      const newEmail = rawEmail || null;

      const [currentDeelnemer] = await db
        .select({
          login: deelnemers.login,
          huisemail: deelnemers.huisemail,
          emailVerified: deelnemers.emailVerified,
        })
        .from(deelnemers)
        .where(eq(deelnemers.id, targetDeelnemerId))
        .limit(1);

      const currentLogin = (currentDeelnemer?.login || '').trim().toLowerCase();
      const currentHuisemail = (currentDeelnemer?.huisemail || '').trim().toLowerCase();
      const normalizedNew = (newEmail || '').trim().toLowerCase();
      const emailWijzigt = normalizedNew !== currentLogin && normalizedNew !== currentHuisemail;

      // Het scherm stuurt het huidige adres gewoon mee, ook als het niet is
      // aangepast. Daarom wordt hier op de waarde vergeleken en niet op de
      // aanwezigheid van het veld: alleen een echte wijziging telt.
      if (emailWijzigt && isDelegatedEdit && !actor.isAdmin) {
        return res.status(403).json({
          error: BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST,
        });
      }

      // Geen enkele adreswijziging loopt hierlangs, ook niet die van de
      // beheerder. Dit endpoint zou de login meteen omzetten naar een adres
      // waarvan niemand weet of de deelnemer erbij kan. Dat bewijs levert
      // alleen de bevestigingsmail naar dat nieuwe adres.
      if (emailWijzigt) {
        return res.status(400).json({
          error:
            'E-mailwijzigingen vereisen bevestiging via een verificatielink. Gebruik het aparte e-mailwijzigingsproces.',
          code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION',
        });
      }

      update.huisemail = newEmail;
      if (newEmail) {
        // De login gaat in kleine letters de database in. Better Auth zoekt een gebruiker op
        // met email.toLowerCase() en vergelijkt dat exact met deze kolom, dus een hoofdletter
        // hier maakt het account onvindbaar voor de resetlink en de magische inloglink.
        const newLogin = normalizeAccountEmail(newEmail);
        if (currentDeelnemer && normalizeAccountEmail(currentDeelnemer.login ?? '') !== newLogin) {
          const [dupe] = await db
            .select({ id: deelnemers.id })
            .from(deelnemers)
            .where(and(eq(deelnemers.login, newLogin), ne(deelnemers.id, targetDeelnemerId)))
            .limit(1);
          if (dupe) {
            return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik als loginnaam' });
          }
          // Hier komt alleen nog de oude situatie langs waarin login en
          // huisemail uit elkaar liepen: het adres zelf verandert niet, de
          // login wordt gelijkgetrokken. emailVerified blijft eraf, want dat
          // zet alleen de bevestigingslink.
          update.login = newLogin;
          update.email = newLogin;
          loginUpdated = true;
        }
      }
    }
    if (body.echtedeelnemer !== undefined && mayEditEchtedeelnemer) {
      update.echtedeelnemer = !!body.echtedeelnemer;
    }
    if (body.smsdienstbegin !== undefined) update.smsdienstbegin = !!body.smsdienstbegin;
    if (body.callRecording !== undefined) update.callRecording = !!body.callRecording;

    let newEncryptedPassword: string | null = null;
    if (passa !== undefined && passb !== undefined && passa === passb) {
      newEncryptedPassword = legacyMD5Hash(passa);
      (update as Record<string, string>).encryptedPassword = newEncryptedPassword;
    }

    if (Object.keys(update).length > 0) {
      await db
        .update(deelnemers)
        .set(update as Record<string, unknown>)
        .where(eq(deelnemers.id, targetDeelnemerId));
    }

    if (newEncryptedPassword !== null) {
      const accountId = `credential-${targetDeelnemerId}`;
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
        const functieVal = (row as { idfunctie?: unknown }).idfunctie;
        if (typeof idwg !== 'number' || !Number.isInteger(idwg) || idwg < 1) {
          return res.status(400).json({ error: `Ongeldige waarneemgroep bij FTE-regel ${i + 1}` });
        }
        if (typeof fteVal !== 'number' || !Number.isFinite(fteVal) || fteVal < 0 || fteVal > 2) {
          return res.status(400).json({
            error: `FTE moet tussen 0 en 2 liggen (waarneemgroep ${idwg})`,
          });
        }
        if (
          functieVal !== undefined &&
          functieVal !== null &&
          (typeof functieVal !== 'number' ||
            !Number.isInteger(functieVal) ||
            !GELDIGE_WAARNEEMGROEP_FUNCTIES.has(functieVal))
        ) {
          return res.status(400).json({
            error: `Functie moet een van de toegestane waarden zijn (waarneemgroep ${idwg})`,
          });
        }
      }
      for (const row of raw) {
        const idwg = (row as { idwaarneemgroep: number }).idwaarneemgroep;
        const fteVal = (row as { fte: number }).fte;
        const functieVal = (row as { idfunctie?: 1 | 2 | 3 | 4 | null }).idfunctie;
        const upd = await db
          .update(waarneemgroepdeelnemers)
          .set({
            fte: fteVal,
            ...(functieVal !== undefined ? { idfunctie: functieVal } : {}),
          })
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, targetDeelnemerId),
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

    if (body.waarneemgroepExpertises !== undefined) {
      const raw = body.waarneemgroepExpertises;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: 'waarneemgroepExpertises moet een array zijn' });
      }

      const parsed: { idwaarneemgroep: number; expertiseIds: number[] }[] = [];
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (!row || typeof row !== 'object') {
          return res.status(400).json({ error: `waarneemgroepExpertises[${i}] is ongeldig` });
        }
        const idwg = (row as { idwaarneemgroep?: unknown }).idwaarneemgroep;
        const expertiseIdsRaw = (row as { expertiseIds?: unknown }).expertiseIds;
        if (typeof idwg !== 'number' || !Number.isInteger(idwg) || idwg < 1) {
          return res.status(400).json({
            error: `Ongeldige waarneemgroep bij expertise-regel ${i + 1}`,
          });
        }
        if (!Array.isArray(expertiseIdsRaw)) {
          return res.status(400).json({
            error: `expertiseIds moet een array zijn (waarneemgroep ${idwg})`,
          });
        }
        const expertiseIds: number[] = [];
        for (const id of expertiseIdsRaw) {
          if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
            return res.status(400).json({
              error: `Ongeldige expertise bij waarneemgroep ${idwg}`,
            });
          }
          if (!expertiseIds.includes(id)) expertiseIds.push(id);
        }
        parsed.push({ idwaarneemgroep: idwg, expertiseIds });
      }

      const wgIds = parsed.map((p) => p.idwaarneemgroep);
      if (wgIds.length > 0) {
        const membershipOk = await db
          .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
          .from(waarneemgroepdeelnemers)
          .where(
            and(
              eq(waarneemgroepdeelnemers.iddeelnemer, targetDeelnemerId),
              eq(waarneemgroepdeelnemers.aangemeld, true),
              inArray(waarneemgroepdeelnemers.idwaarneemgroep, wgIds)
            )
          );
        const memberSet = new Set(
          membershipOk
            .map((m) => m.idwaarneemgroep)
            .filter((id): id is number => id != null)
        );
        if (memberSet.size !== new Set(wgIds).size) {
          return res.status(403).json({
            error: 'U bent niet aangemeld bij een van de opgegeven waarneemgroepen',
          });
        }

        const allExpertiseIds = [...new Set(parsed.flatMap((p) => p.expertiseIds))];
        const [catalogRows, currentlySelectedRows] = await Promise.all([
          db
            .select({
              id: expertises.id,
              idwaarneemgroep: expertises.idwaarneemgroep,
              actief: expertises.actief,
            })
            .from(expertises)
            .where(inArray(expertises.idwaarneemgroep, wgIds)),
          allExpertiseIds.length > 0
            ? db
                .select({ idexpertise: deelnemerexpertises.idexpertise })
                .from(deelnemerexpertises)
                .where(
                  and(
                    eq(deelnemerexpertises.iddeelnemer, targetDeelnemerId),
                    inArray(deelnemerexpertises.idexpertise, allExpertiseIds)
                  )
                )
            : Promise.resolve([] as { idexpertise: number }[]),
        ]);

        const catalogById = new Map(catalogRows.map((r) => [r.id, r]));
        const currentlySelected = new Set(currentlySelectedRows.map((r) => r.idexpertise));
        const catalogIdsByWg = new Map<number, number[]>();
        for (const row of catalogRows) {
          const list = catalogIdsByWg.get(row.idwaarneemgroep) ?? [];
          list.push(row.id);
          catalogIdsByWg.set(row.idwaarneemgroep, list);
        }

        for (const row of parsed) {
          for (const expertiseId of row.expertiseIds) {
            const cat = catalogById.get(expertiseId);
            if (!cat || cat.idwaarneemgroep !== row.idwaarneemgroep) {
              return res.status(400).json({
                error: `Expertise ${expertiseId} hoort niet bij waarneemgroep ${row.idwaarneemgroep}`,
              });
            }
            if (!cat.actief && !currentlySelected.has(expertiseId)) {
              return res.status(400).json({
                error: `Expertise ${expertiseId} is niet actief (waarneemgroep ${row.idwaarneemgroep})`,
              });
            }
          }
        }

        await db.transaction(async (tx) => {
          for (const row of parsed) {
            const groupExpertiseIds = catalogIdsByWg.get(row.idwaarneemgroep) ?? [];
            if (groupExpertiseIds.length > 0) {
              await tx
                .delete(deelnemerexpertises)
                .where(
                  and(
                    eq(deelnemerexpertises.iddeelnemer, targetDeelnemerId),
                    inArray(deelnemerexpertises.idexpertise, groupExpertiseIds)
                  )
                );
            }
            if (row.expertiseIds.length > 0) {
              await tx.insert(deelnemerexpertises).values(
                row.expertiseIds.map((idexpertise) => ({
                  iddeelnemer: targetDeelnemerId,
                  idexpertise,
                }))
              );
            }
          }
        });
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
        const telnrRaw = typeof slot.telnr === 'string' ? slot.telnr.trim() : '';
        if (!telnrRaw) {
          return res.status(400).json({ error: `Telefoonnummer ${i + 1} mag niet leeg zijn` });
        }
        const normalized = normalizeDutchPhoneToIntl(telnrRaw);
        if (!normalized) {
          return res.status(400).json({ error: `Telefoonnummer ${i + 1} is ongeldig: "${telnrRaw}"` });
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
        sSet[`telnr${n}`] = slot ? normalizeDutchPhoneToIntl(String(slot.telnr).trim()) : null;
        sSet[`smsontvanger${n}`] = slot ? !!slot.smsontvanger : null;
        sSet[`idlocatietelnr${n}`] = slot ? slot.idlocatietelnr : null;
        sSet[`idomschrtelnr${n}`] = slot ? slot.idomschrtelnr : null;
      }

      // Find current idsettelnrdienst (re-fetch to avoid races)
      const [deelnRecord] = await db
        .select({ idsettelnrdienst: deelnemers.idsettelnrdienst })
        .from(deelnemers)
        .where(eq(deelnemers.id, targetDeelnemerId))
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
          .where(eq(deelnemers.id, targetDeelnemerId));
      }
    }

    return res.status(200).json({ success: true, loginUpdated });
  } catch (err) {
    if (err instanceof Error && err.message.includes('is ongeldig')) {
      return res.status(400).json({
        error: err.message,
      });
    }
    console.error('PATCH /api/mijn-gegevens error', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
