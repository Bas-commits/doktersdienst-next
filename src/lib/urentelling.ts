import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { intervalsOverlap } from '@/hooks/useDienstenSchedule';

export type DienstCategory = 'dienst' | 'achterwacht' | 'extraDokter' | 'overnameAccepted';

export type UrentellingDienst = {
  iddeelnemer: number | null;
  iddeelnovern?: number | null;
  van: number;
  tot: number;
  type: number | null;
  status: string | null;
};

export type UrentellingBaseSlot = {
  van: number;
  tot: number;
  idaantekening: number | null;
};

export type UrentellingAantekening = {
  id: number;
  tekst: string | null;
  prio: number | null;
};

export type UrentellingColumn = {
  id: number;
  tekst: string;
};

export type UrentellingMember = {
  iddeelnemer: number;
  achternaam: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  initialen: string | null;
  color: string | null;
};

export type UrentellingRow = {
  iddeelnemer: number;
  naam: string;
  initials: string;
  color: string;
  urenPerAantekening: number[];
  achterwachtPerAantekening: number[];
  totaalDienst: number;
  totaalAchterwacht: number;
};

export type UrentellingDetailRow = {
  iddeelnemer: number;
  naam: string;
  categorie: string;
  idaantekening: number;
  aantekening: string;
  van: number;
  tot: number;
  uren: number;
};

export const NO_AANTEKENING_COLUMN_ID = 0;
export const NO_AANTEKENING_LABEL = '—';

type AantekeningTotals = {
  dienstSec: Map<number, number>;
  achterwachtSec: Map<number, number>;
};

function normalizeStatus(status: string | null): string | null {
  if (status == null || String(status).trim() === '') return null;
  return String(status).trim().toLowerCase();
}

export function clippedSeconds(
  van: number,
  tot: number,
  windowStart: number,
  windowEnd: number,
): number {
  return Math.max(0, Math.min(tot, windowEnd) - Math.max(van, windowStart));
}

export function classifyDienstCategory(
  type: number | null,
  status: string | null,
): DienstCategory | null {
  if (type == null) return null;

  const normalizedStatus = normalizeStatus(status);

  if (type === 5) return 'achterwacht';
  if (type === 11) return 'extraDokter';

  if (type === 6 && normalizedStatus === 'accepted') return 'overnameAccepted';

  if (type === 4 && (normalizedStatus === 'pending' || normalizedStatus === 'declined')) {
    return null;
  }

  if (type === 0 || ((type === 4 || type === 6) && normalizedStatus === null)) {
    return 'dienst';
  }

  return null;
}

export function secondsToDecimalHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

function clippedInterval(
  van: number,
  tot: number,
  windowStart: number,
  windowEnd: number,
): { van: number; tot: number } {
  return {
    van: Math.max(van, windowStart),
    tot: Math.min(tot, windowEnd),
  };
}

const CATEGORY_LABELS: Record<Exclude<DienstCategory, 'overnameAccepted' | 'extraDokter'>, string> = {
  dienst: 'Dienst',
  achterwacht: 'Achterwacht',
};

export function formatDeelnemerNaam(member: UrentellingMember): string {
  return [member.achternaam, member.voornaam, member.voorletterstussenvoegsel]
    .filter(Boolean)
    .join(', ');
}

export function formatDeelnemerInitials(member: UrentellingMember): string {
  return deelnemerChipInitials(member, { maxFallbackLength: 3, fallback: '—' });
}

function normalizeAantekeningId(idaantekening: number | null | undefined): number {
  if (idaantekening == null || idaantekening <= 0) return NO_AANTEKENING_COLUMN_ID;
  return idaantekening;
}

export function resolveAantekeningId(
  dienst: Pick<UrentellingDienst, 'van' | 'tot'>,
  baseSlots: UrentellingBaseSlot[],
): number {
  for (const base of baseSlots) {
    if (intervalsOverlap(dienst.van, dienst.tot, base.van, base.tot)) {
      return normalizeAantekeningId(base.idaantekening);
    }
  }
  return NO_AANTEKENING_COLUMN_ID;
}

function aantekeningLabelById(
  aantekeningen: UrentellingAantekening[],
  idaantekening: number,
): string {
  if (idaantekening === NO_AANTEKENING_COLUMN_ID) return NO_AANTEKENING_LABEL;
  const match = aantekeningen.find((a) => a.id === idaantekening);
  const tekst = match?.tekst?.trim();
  return tekst && tekst !== '' ? tekst : NO_AANTEKENING_LABEL;
}

function emptyAantekeningTotals(): AantekeningTotals {
  return { dienstSec: new Map(), achterwachtSec: new Map() };
}

function ensureMemberTotals(
  totals: Map<number, AantekeningTotals>,
  iddeelnemer: number,
): AantekeningTotals {
  if (!totals.has(iddeelnemer)) {
    totals.set(iddeelnemer, emptyAantekeningTotals());
  }
  return totals.get(iddeelnemer)!;
}

function addSeconds(
  map: Map<number, number>,
  idaantekening: number,
  seconds: number,
): void {
  map.set(idaantekening, (map.get(idaantekening) ?? 0) + seconds);
}

function addDienstSeconds(
  totals: Map<number, AantekeningTotals>,
  iddeelnemer: number,
  idaantekening: number,
  seconds: number,
): void {
  const row = ensureMemberTotals(totals, iddeelnemer);
  addSeconds(row.dienstSec, idaantekening, seconds);
}

function addAchterwachtSeconds(
  totals: Map<number, AantekeningTotals>,
  iddeelnemer: number,
  idaantekening: number,
  seconds: number,
): void {
  const row = ensureMemberTotals(totals, iddeelnemer);
  addSeconds(row.achterwachtSec, idaantekening, seconds);
}

function memberNameById(members: UrentellingMember[], iddeelnemer: number): string {
  const member = members.find((m) => m.iddeelnemer === iddeelnemer);
  return member ? formatDeelnemerNaam(member) : `#${iddeelnemer}`;
}

function sortMembers(members: UrentellingMember[]): UrentellingMember[] {
  return [...members].sort((a, b) => {
    const achternaamCmp = (a.achternaam ?? '').localeCompare(b.achternaam ?? '', 'nl');
    if (achternaamCmp !== 0) return achternaamCmp;
    return (a.voornaam ?? '').localeCompare(b.voornaam ?? '', 'nl');
  });
}

export function buildUrentellingColumns(
  aantekeningen: UrentellingAantekening[],
  usedAantekeningIds: Set<number>,
): UrentellingColumn[] {
  const sorted = [...aantekeningen].sort((a, b) => {
    const prioA = a.prio ?? Number.MAX_SAFE_INTEGER;
    const prioB = b.prio ?? Number.MAX_SAFE_INTEGER;
    if (prioA !== prioB) return prioA - prioB;
    return (a.tekst ?? '').localeCompare(b.tekst ?? '', 'nl');
  });

  const columns: UrentellingColumn[] = sorted.map((a) => ({
    id: a.id,
    tekst: a.tekst?.trim() || NO_AANTEKENING_LABEL,
  }));

  if (usedAantekeningIds.has(NO_AANTEKENING_COLUMN_ID)) {
    columns.push({ id: NO_AANTEKENING_COLUMN_ID, tekst: NO_AANTEKENING_LABEL });
  }

  return columns;
}

function hoursArrayForColumns(
  columns: UrentellingColumn[],
  secondsByAantekening: Map<number, number>,
): number[] {
  return columns.map((column) =>
    secondsToDecimalHours(secondsByAantekening.get(column.id) ?? 0),
  );
}

function sumDecimalHours(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function collectUsedAantekeningIds(totals: Map<number, AantekeningTotals>): Set<number> {
  const used = new Set<number>();
  for (const memberTotals of totals.values()) {
    for (const id of memberTotals.dienstSec.keys()) used.add(id);
    for (const id of memberTotals.achterwachtSec.keys()) used.add(id);
  }
  return used;
}

export function aggregateUrentelling(
  diensten: UrentellingDienst[],
  members: UrentellingMember[],
  windowStart: number,
  windowEnd: number,
  baseSlots: UrentellingBaseSlot[],
  aantekeningen: UrentellingAantekening[],
): { columns: UrentellingColumn[]; rows: UrentellingRow[] } {
  const totals = new Map<number, AantekeningTotals>();

  for (const member of members) {
    totals.set(member.iddeelnemer, emptyAantekeningTotals());
  }

  for (const dienst of diensten) {
    const category = classifyDienstCategory(dienst.type, dienst.status);
    if (!category || category === 'extraDokter') continue;

    const seconds = clippedSeconds(dienst.van, dienst.tot, windowStart, windowEnd);
    if (seconds <= 0) continue;

    const idaantekening = resolveAantekeningId(dienst, baseSlots);

    if (category === 'overnameAccepted') {
      const original = dienst.iddeelnemer;
      const target = dienst.iddeelnovern;
      if (original != null && original > 0) {
        addDienstSeconds(totals, original, idaantekening, -seconds);
      }
      if (target != null && target > 0) {
        addDienstSeconds(totals, target, idaantekening, seconds);
      }
      continue;
    }

    const iddeelnemer = dienst.iddeelnemer;
    if (iddeelnemer == null || iddeelnemer <= 0) continue;

    if (category === 'dienst') {
      addDienstSeconds(totals, iddeelnemer, idaantekening, seconds);
    } else if (category === 'achterwacht') {
      addAchterwachtSeconds(totals, iddeelnemer, idaantekening, seconds);
    }
  }

  const columns = buildUrentellingColumns(aantekeningen, collectUsedAantekeningIds(totals));

  const rows = sortMembers(members).map((member) => {
    const memberTotals = totals.get(member.iddeelnemer) ?? emptyAantekeningTotals();
    const urenPerAantekening = hoursArrayForColumns(columns, memberTotals.dienstSec);
    const achterwachtPerAantekening = hoursArrayForColumns(columns, memberTotals.achterwachtSec);

    return {
      iddeelnemer: member.iddeelnemer,
      naam: formatDeelnemerNaam(member),
      initials: formatDeelnemerInitials(member),
      color: member.color?.trim() || '#cccccc',
      urenPerAantekening,
      achterwachtPerAantekening,
      totaalDienst: sumDecimalHours(urenPerAantekening),
      totaalAchterwacht: sumDecimalHours(achterwachtPerAantekening),
    };
  });

  return { columns, rows };
}

export function collectUrentellingDetails(
  diensten: UrentellingDienst[],
  members: UrentellingMember[],
  windowStart: number,
  windowEnd: number,
  baseSlots: UrentellingBaseSlot[],
  aantekeningen: UrentellingAantekening[],
): UrentellingDetailRow[] {
  const details: UrentellingDetailRow[] = [];

  for (const dienst of diensten) {
    const category = classifyDienstCategory(dienst.type, dienst.status);
    if (!category || category === 'extraDokter') continue;

    const seconds = clippedSeconds(dienst.van, dienst.tot, windowStart, windowEnd);
    if (seconds <= 0) continue;

    const interval = clippedInterval(dienst.van, dienst.tot, windowStart, windowEnd);
    const uren = secondsToDecimalHours(seconds);
    const idaantekening = resolveAantekeningId(dienst, baseSlots);
    const aantekening = aantekeningLabelById(aantekeningen, idaantekening);

    if (category === 'overnameAccepted') {
      const original = dienst.iddeelnemer;
      const target = dienst.iddeelnovern;
      if (original != null && original > 0) {
        details.push({
          iddeelnemer: original,
          naam: memberNameById(members, original),
          categorie: 'Dienst (overname afgegeven)',
          idaantekening,
          aantekening,
          van: interval.van,
          tot: interval.tot,
          uren: -uren,
        });
      }
      if (target != null && target > 0) {
        details.push({
          iddeelnemer: target,
          naam: memberNameById(members, target),
          categorie: 'Dienst (overname ontvangen)',
          idaantekening,
          aantekening,
          van: interval.van,
          tot: interval.tot,
          uren,
        });
      }
      continue;
    }

    const iddeelnemer = dienst.iddeelnemer;
    if (iddeelnemer == null || iddeelnemer <= 0) continue;

    details.push({
      iddeelnemer,
      naam: memberNameById(members, iddeelnemer),
      categorie: CATEGORY_LABELS[category],
      idaantekening,
      aantekening,
      van: interval.van,
      tot: interval.tot,
      uren,
    });
  }

  return details.sort((a, b) => {
    if (a.van !== b.van) return a.van - b.van;
    const naamCmp = a.naam.localeCompare(b.naam, 'nl');
    if (naamCmp !== 0) return naamCmp;
    return a.categorie.localeCompare(b.categorie, 'nl');
  });
}
