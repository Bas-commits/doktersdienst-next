import { and, eq, gt, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { formatAmsterdamTimeFromUnixSeconds } from '@/lib/amsterdamWallTime';
import { assignmentTypeForSectie, toOvernameSectie } from '@/lib/overname-sectie';
import { normalizeDutchPhoneToIntl } from '@/lib/phone-number';

const { diensten, deelnemers, settelnrs, waarneemgroepen, smsDienstBegin } = schema;

const SHIFT_TYPES = [0, 5, 11] as const;

export type DienstBeginShift = {
  id: number;
  type: number;
  van: number;
  tot: number;
  iddeelnemer: number;
  idwaarneemgroep: number;
  waarneemgroepNaam: string;
};

export type DienstBeginOvername = {
  id: number;
  van: number;
  tot: number;
  iddeelnemer: number;
  iddeelnovern: number;
  idwaarneemgroep: number;
  overnameSectie: string | null;
  waarneemgroepNaam: string;
};

export type DienstBeginPhone = {
  iddeelnemer: number;
  voornaam: string | null;
  telnr1: string | null;
  smsontvanger1: boolean | null;
};

export type DienstBeginCandidate = {
  /** Claim key: base shift id, or later partial overname id. */
  iddienst: number;
  iddeelnemer: number;
  voornaam: string;
  waarneemgroepNaam: string;
  van: number;
  tot: number;
  toE164: string;
  text: string;
};

export type DienstBeginSkipped = {
  iddienst: number;
  iddeelnemer: number | null;
  reason: 'missing-phone' | 'invalid-phone' | 'sms-not-enabled' | 'missing-deelnemer';
};

function overnameMatchesShiftType(overnameSectie: string | null | undefined, shiftType: number): boolean {
  return assignmentTypeForSectie(toOvernameSectie(overnameSectie)) === shiftType;
}

/**
 * Who is on duty at the start of an assigned shift, walking accepted overnames in time order
 * (same chain logic as the tel-server sync).
 */
export function resolveOnDutyDeelnemerId(
  shift: Pick<DienstBeginShift, 'type' | 'van' | 'tot' | 'iddeelnemer' | 'idwaarneemgroep'>,
  overnames: readonly DienstBeginOvername[],
): number {
  let onDuty = shift.iddeelnemer;

  const covering = overnames
    .filter(
      (o) =>
        o.idwaarneemgroep === shift.idwaarneemgroep &&
        overnameMatchesShiftType(o.overnameSectie, shift.type) &&
        o.van <= shift.van &&
        o.tot > shift.van,
    )
    .sort((a, b) => a.van - b.van || a.id - b.id);

  for (const o of covering) {
    if (o.iddeelnemer === onDuty && o.iddeelnovern > 0) {
      onDuty = o.iddeelnovern;
    }
  }

  return onDuty;
}

/** True when this accepted overname starts mid-shift (after the underlying assignment's van). */
export function isLaterPartialOvername(
  overname: DienstBeginOvername,
  shifts: readonly DienstBeginShift[],
): boolean {
  const laneType = assignmentTypeForSectie(toOvernameSectie(overname.overnameSectie));
  return shifts.some(
    (s) =>
      s.idwaarneemgroep === overname.idwaarneemgroep &&
      s.type === laneType &&
      s.iddeelnemer === overname.iddeelnemer &&
      s.van < overname.van &&
      s.tot > overname.van,
  );
}

export function buildDienstBeginText(
  voornaam: string,
  waarneemgroepNaam: string,
  van: number,
  tot: number,
): string {
  const vanLabel = formatAmsterdamTimeFromUnixSeconds(van);
  const totLabel = formatAmsterdamTimeFromUnixSeconds(tot);
  return `Beste ${voornaam},\nUw dienst in ${waarneemgroepNaam} begint om ${vanLabel} en duurt tot ${totLabel}`;
}

export function toBirdE164(telnr: string): string | null {
  const intl = normalizeDutchPhoneToIntl(telnr);
  return intl ? `+${intl}` : null;
}

export function resolveDienstBeginCandidates(
  shifts: readonly DienstBeginShift[],
  overnamesInWindow: readonly DienstBeginOvername[],
  coveringOvernames: readonly DienstBeginOvername[],
  underlyingShifts: readonly DienstBeginShift[],
  phones: ReadonlyMap<number, DienstBeginPhone>,
): { candidates: DienstBeginCandidate[]; skipped: DienstBeginSkipped[] } {
  const candidates: DienstBeginCandidate[] = [];
  const skipped: DienstBeginSkipped[] = [];
  const claimed = new Set<number>();

  const pushFor = (
    iddienst: number,
    iddeelnemer: number,
    waarneemgroepNaam: string,
    van: number,
    tot: number,
  ) => {
    if (claimed.has(iddienst)) return;
    claimed.add(iddienst);

    if (!iddeelnemer || iddeelnemer <= 0) {
      skipped.push({ iddienst, iddeelnemer: null, reason: 'missing-deelnemer' });
      return;
    }

    const phone = phones.get(iddeelnemer);
    if (!phone) {
      skipped.push({ iddienst, iddeelnemer, reason: 'missing-deelnemer' });
      return;
    }
    if (!phone.smsontvanger1) {
      skipped.push({ iddienst, iddeelnemer, reason: 'sms-not-enabled' });
      return;
    }
    if (!phone.telnr1?.trim()) {
      skipped.push({ iddienst, iddeelnemer, reason: 'missing-phone' });
      return;
    }
    const toE164 = toBirdE164(phone.telnr1);
    if (!toE164) {
      skipped.push({ iddienst, iddeelnemer, reason: 'invalid-phone' });
      return;
    }

    const voornaam = (phone.voornaam ?? '').trim() || 'dokter';
    candidates.push({
      iddienst,
      iddeelnemer,
      voornaam,
      waarneemgroepNaam,
      van,
      tot,
      toE164,
      text: buildDienstBeginText(voornaam, waarneemgroepNaam, van, tot),
    });
  };

  for (const shift of shifts) {
    if (!shift.id || shift.id <= 0) continue;
    const onDuty = resolveOnDutyDeelnemerId(shift, coveringOvernames);
    pushFor(shift.id, onDuty, shift.waarneemgroepNaam, shift.van, shift.tot);
  }

  for (const overname of overnamesInWindow) {
    if (!overname.id || overname.id <= 0) continue;
    if (!isLaterPartialOvername(overname, underlyingShifts)) continue;
    pushFor(
      overname.id,
      overname.iddeelnovern,
      overname.waarneemgroepNaam,
      overname.van,
      overname.tot,
    );
  }

  return { candidates, skipped };
}

async function loadAlreadySentIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ iddienst: smsDienstBegin.iddienst })
    .from(smsDienstBegin)
    .where(inArray(smsDienstBegin.iddienst, ids));
  return new Set(rows.map((r) => r.iddienst));
}

async function loadPhones(ids: number[]): Promise<Map<number, DienstBeginPhone>> {
  const unique = [...new Set(ids.filter((id) => id > 0))];
  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      iddeelnemer: deelnemers.id,
      voornaam: deelnemers.voornaam,
      telnr1: settelnrs.telnr1,
      smsontvanger1: settelnrs.smsontvanger1,
    })
    .from(deelnemers)
    .leftJoin(settelnrs, eq(deelnemers.idsettelnrdienst, settelnrs.id))
    .where(inArray(deelnemers.id, unique));

  const map = new Map<number, DienstBeginPhone>();
  for (const row of rows) {
    if (row.iddeelnemer == null) continue;
    map.set(row.iddeelnemer, {
      iddeelnemer: row.iddeelnemer,
      voornaam: row.voornaam,
      telnr1: row.telnr1,
      smsontvanger1: row.smsontvanger1,
    });
  }
  return map;
}

/**
 * Loads shifts that start within [now, now+minutes) for waarneemgroepen with SMS begin dienst,
 * resolves who is on duty (including later partial overnames), and builds Bird-ready messages.
 */
export async function findDienstBeginCandidates(
  nowUnix: number,
  minutes: number,
): Promise<{ candidates: DienstBeginCandidate[]; skipped: DienstBeginSkipped[] }> {
  const until = nowUnix + minutes * 60;

  const shiftRows = await db
    .select({
      id: diensten.id,
      type: diensten.type,
      van: diensten.van,
      tot: diensten.tot,
      iddeelnemer: diensten.iddeelnemer,
      idwaarneemgroep: diensten.idwaarneemgroep,
      waarneemgroepNaam: waarneemgroepen.naam,
    })
    .from(diensten)
    .innerJoin(waarneemgroepen, eq(diensten.idwaarneemgroep, waarneemgroepen.id))
    .where(
      and(
        inArray(diensten.type, [...SHIFT_TYPES]),
        eq(waarneemgroepen.smsdienstbegin, true),
        gte(diensten.van, nowUnix),
        lt(diensten.van, until),
        sql`${diensten.iddeelnemer} IS NOT NULL AND ${diensten.iddeelnemer} > 0`,
        sql`${diensten.id} IS NOT NULL AND ${diensten.id} > 0`,
      ),
    );

  const overnamesInWindowRows = await db
    .select({
      id: diensten.id,
      van: diensten.van,
      tot: diensten.tot,
      iddeelnemer: diensten.iddeelnemer,
      iddeelnovern: diensten.iddeelnovern,
      idwaarneemgroep: diensten.idwaarneemgroep,
      overnameSectie: diensten.overnameSectie,
      waarneemgroepNaam: waarneemgroepen.naam,
    })
    .from(diensten)
    .innerJoin(waarneemgroepen, eq(diensten.idwaarneemgroep, waarneemgroepen.id))
    .where(
      and(
        eq(diensten.type, 6),
        sql`lower(trim(coalesce(${diensten.status}, ''))) = 'accepted'`,
        eq(waarneemgroepen.smsdienstbegin, true),
        gte(diensten.van, nowUnix),
        lt(diensten.van, until),
        sql`${diensten.iddeelnovern} IS NOT NULL AND ${diensten.iddeelnovern} > 0`,
        sql`${diensten.id} IS NOT NULL AND ${diensten.id} > 0`,
      ),
    );

  const shifts: DienstBeginShift[] = shiftRows
    .filter((r) => r.id != null && r.van != null && r.tot != null && r.iddeelnemer != null && r.idwaarneemgroep != null)
    .map((r) => ({
      id: r.id!,
      type: r.type ?? 0,
      van: r.van!,
      tot: r.tot!,
      iddeelnemer: r.iddeelnemer!,
      idwaarneemgroep: r.idwaarneemgroep!,
      waarneemgroepNaam: (r.waarneemgroepNaam ?? '').trim() || 'waarneemgroep',
    }));

  const overnamesInWindow: DienstBeginOvername[] = overnamesInWindowRows
    .filter(
      (r) =>
        r.id != null &&
        r.van != null &&
        r.tot != null &&
        r.iddeelnemer != null &&
        r.iddeelnovern != null &&
        r.idwaarneemgroep != null,
    )
    .map((r) => ({
      id: r.id!,
      van: r.van!,
      tot: r.tot!,
      iddeelnemer: r.iddeelnemer!,
      iddeelnovern: r.iddeelnovern!,
      idwaarneemgroep: r.idwaarneemgroep!,
      overnameSectie: r.overnameSectie,
      waarneemgroepNaam: (r.waarneemgroepNaam ?? '').trim() || 'waarneemgroep',
    }));

  const wgIds = [
    ...new Set([
      ...shifts.map((s) => s.idwaarneemgroep),
      ...overnamesInWindow.map((o) => o.idwaarneemgroep),
    ]),
  ];

  let coveringOvernames: DienstBeginOvername[] = [];
  if (shifts.length > 0 && wgIds.length > 0) {
    const minVan = Math.min(...shifts.map((s) => s.van));
    const maxVan = Math.max(...shifts.map((s) => s.van));
    const coveringRows = await db
      .select({
        id: diensten.id,
        van: diensten.van,
        tot: diensten.tot,
        iddeelnemer: diensten.iddeelnemer,
        iddeelnovern: diensten.iddeelnovern,
        idwaarneemgroep: diensten.idwaarneemgroep,
        overnameSectie: diensten.overnameSectie,
        waarneemgroepNaam: waarneemgroepen.naam,
      })
      .from(diensten)
      .innerJoin(waarneemgroepen, eq(diensten.idwaarneemgroep, waarneemgroepen.id))
      .where(
        and(
          eq(diensten.type, 6),
          sql`lower(trim(coalesce(${diensten.status}, ''))) = 'accepted'`,
          inArray(diensten.idwaarneemgroep, wgIds),
          lte(diensten.van, maxVan),
          gt(diensten.tot, minVan),
          sql`${diensten.iddeelnovern} IS NOT NULL AND ${diensten.iddeelnovern} > 0`,
        ),
      );

    coveringOvernames = coveringRows
      .filter(
        (r) =>
          r.id != null &&
          r.van != null &&
          r.tot != null &&
          r.iddeelnemer != null &&
          r.iddeelnovern != null &&
          r.idwaarneemgroep != null,
      )
      .map((r) => ({
        id: r.id!,
        van: r.van!,
        tot: r.tot!,
        iddeelnemer: r.iddeelnemer!,
        iddeelnovern: r.iddeelnovern!,
        idwaarneemgroep: r.idwaarneemgroep!,
        overnameSectie: r.overnameSectie,
        waarneemgroepNaam: (r.waarneemgroepNaam ?? '').trim() || 'waarneemgroep',
      }));
  }

  let underlyingShifts: DienstBeginShift[] = [];
  if (overnamesInWindow.length > 0 && wgIds.length > 0) {
    const minOvernVan = Math.min(...overnamesInWindow.map((o) => o.van));
    const maxOvernVan = Math.max(...overnamesInWindow.map((o) => o.van));
    const underlyingRows = await db
      .select({
        id: diensten.id,
        type: diensten.type,
        van: diensten.van,
        tot: diensten.tot,
        iddeelnemer: diensten.iddeelnemer,
        idwaarneemgroep: diensten.idwaarneemgroep,
        waarneemgroepNaam: waarneemgroepen.naam,
      })
      .from(diensten)
      .innerJoin(waarneemgroepen, eq(diensten.idwaarneemgroep, waarneemgroepen.id))
      .where(
        and(
          inArray(diensten.type, [...SHIFT_TYPES]),
          inArray(diensten.idwaarneemgroep, wgIds),
          lt(diensten.van, maxOvernVan),
          gt(diensten.tot, minOvernVan),
          sql`${diensten.iddeelnemer} IS NOT NULL AND ${diensten.iddeelnemer} > 0`,
        ),
      );

    underlyingShifts = underlyingRows
      .filter(
        (r) =>
          r.id != null &&
          r.van != null &&
          r.tot != null &&
          r.iddeelnemer != null &&
          r.idwaarneemgroep != null,
      )
      .map((r) => ({
        id: r.id!,
        type: r.type ?? 0,
        van: r.van!,
        tot: r.tot!,
        iddeelnemer: r.iddeelnemer!,
        idwaarneemgroep: r.idwaarneemgroep!,
        waarneemgroepNaam: (r.waarneemgroepNaam ?? '').trim() || 'waarneemgroep',
      }));
  }

  const candidateIds = [
    ...shifts.map((s) => s.id),
    ...overnamesInWindow.map((o) => o.id),
  ];
  const alreadySent = await loadAlreadySentIds(candidateIds);

  const shiftsFresh = shifts.filter((s) => !alreadySent.has(s.id));
  const overnamesFresh = overnamesInWindow.filter((o) => !alreadySent.has(o.id));

  const recipientIds = new Set<number>();
  for (const s of shiftsFresh) {
    recipientIds.add(resolveOnDutyDeelnemerId(s, coveringOvernames));
  }
  for (const o of overnamesFresh) {
    if (isLaterPartialOvername(o, underlyingShifts)) {
      recipientIds.add(o.iddeelnovern);
    }
  }

  const phones = await loadPhones([...recipientIds]);
  return resolveDienstBeginCandidates(
    shiftsFresh,
    overnamesFresh,
    coveringOvernames,
    underlyingShifts,
    phones,
  );
}

/** Claim send slots; only returned rows were newly inserted (safe under concurrent callers). */
export async function claimDienstBeginSends(
  candidates: readonly DienstBeginCandidate[],
): Promise<DienstBeginCandidate[]> {
  if (candidates.length === 0) return [];

  const values = candidates.map((c) => ({
    iddienst: c.iddienst,
    iddeelnemer: c.iddeelnemer,
    nummer: c.toE164,
  }));

  const inserted = await db
    .insert(smsDienstBegin)
    .values(values)
    .onConflictDoNothing({ target: smsDienstBegin.iddienst })
    .returning({ iddienst: smsDienstBegin.iddienst });

  const claimedIds = new Set(inserted.map((r) => r.iddienst));
  return candidates.filter((c) => claimedIds.has(c.iddienst));
}

export async function releaseDienstBeginClaims(iddiensten: number[]): Promise<void> {
  if (iddiensten.length === 0) return;
  await db.delete(smsDienstBegin).where(inArray(smsDienstBegin.iddienst, iddiensten));
}

export function isSmsDevelopmentMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === 'development' || env.NEXT_PUBLIC_NODE_ENV === 'development';
}
