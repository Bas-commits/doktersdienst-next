export type DienstCategory = 'dienst' | 'achterwacht' | 'extraDokter' | 'overnameAccepted';

export type UrentellingDienst = {
  iddeelnemer: number | null;
  iddeelnovern?: number | null;
  van: number;
  tot: number;
  type: number | null;
  status: string | null;
};

export type UrentellingMember = {
  iddeelnemer: number;
  achternaam: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  color: string | null;
};

export type UrentellingRow = {
  iddeelnemer: number;
  naam: string;
  initials: string;
  color: string;
  achterwacht: number;
  dienst: number;
  extraDokter: number;
  totaal: number;
};

export type UrentellingDetailRow = {
  iddeelnemer: number;
  naam: string;
  categorie: string;
  van: number;
  tot: number;
  uren: number;
};

type UrentellingTotals = {
  achterwachtSec: number;
  dienstSec: number;
  extraDokterSec: number;
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

const CATEGORY_LABELS: Record<Exclude<DienstCategory, 'overnameAccepted'>, string> = {
  dienst: 'Dienst',
  achterwacht: 'Achterwacht',
  extraDokter: 'Extra dokter',
};

export function formatDeelnemerNaam(member: UrentellingMember): string {
  return [member.achternaam, member.voornaam, member.voorletterstussenvoegsel]
    .filter(Boolean)
    .join(', ');
}

export function formatDeelnemerInitials(member: UrentellingMember): string {
  const fallback = [member.voornaam, member.achternaam]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().charAt(0).toUpperCase())
    .join('');
  return fallback.slice(0, 3) || '—';
}

function emptyTotals(): UrentellingTotals {
  return { achterwachtSec: 0, dienstSec: 0, extraDokterSec: 0 };
}

function ensureTotals(totals: Map<number, UrentellingTotals>, iddeelnemer: number): void {
  if (!totals.has(iddeelnemer)) {
    totals.set(iddeelnemer, emptyTotals());
  }
}

function addDienstSeconds(
  totals: Map<number, UrentellingTotals>,
  iddeelnemer: number,
  seconds: number,
): void {
  ensureTotals(totals, iddeelnemer);
  totals.get(iddeelnemer)!.dienstSec += seconds;
}

function memberNameById(members: UrentellingMember[], iddeelnemer: number): string {
  const member = members.find((m) => m.iddeelnemer === iddeelnemer);
  return member ? formatDeelnemerNaam(member) : `#${iddeelnemer}`;
}

export function collectUrentellingDetails(
  diensten: UrentellingDienst[],
  members: UrentellingMember[],
  windowStart: number,
  windowEnd: number,
): UrentellingDetailRow[] {
  const details: UrentellingDetailRow[] = [];

  for (const dienst of diensten) {
    const category = classifyDienstCategory(dienst.type, dienst.status);
    if (!category) continue;

    const seconds = clippedSeconds(dienst.van, dienst.tot, windowStart, windowEnd);
    if (seconds <= 0) continue;

    const interval = clippedInterval(dienst.van, dienst.tot, windowStart, windowEnd);
    const uren = secondsToDecimalHours(seconds);

    if (category === 'overnameAccepted') {
      const original = dienst.iddeelnemer;
      const target = dienst.iddeelnovern;
      if (original != null && original > 0) {
        details.push({
          iddeelnemer: original,
          naam: memberNameById(members, original),
          categorie: 'Dienst (overname afgegeven)',
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

export function aggregateUrentelling(
  diensten: UrentellingDienst[],
  members: UrentellingMember[],
  windowStart: number,
  windowEnd: number,
): UrentellingRow[] {
  const totals = new Map<number, UrentellingTotals>();

  for (const member of members) {
    totals.set(member.iddeelnemer, emptyTotals());
  }

  for (const dienst of diensten) {
    const category = classifyDienstCategory(dienst.type, dienst.status);
    if (!category) continue;

    const seconds = clippedSeconds(dienst.van, dienst.tot, windowStart, windowEnd);
    if (seconds <= 0) continue;

    if (category === 'overnameAccepted') {
      const original = dienst.iddeelnemer;
      const target = dienst.iddeelnovern;
      if (original != null && original > 0) {
        addDienstSeconds(totals, original, -seconds);
      }
      if (target != null && target > 0) {
        addDienstSeconds(totals, target, seconds);
      }
      continue;
    }

    const iddeelnemer = dienst.iddeelnemer;
    if (iddeelnemer == null || iddeelnemer <= 0) continue;

    ensureTotals(totals, iddeelnemer);
    const row = totals.get(iddeelnemer)!;

    if (category === 'dienst') {
      row.dienstSec += seconds;
    } else if (category === 'achterwacht') {
      row.achterwachtSec += seconds;
    } else if (category === 'extraDokter') {
      row.extraDokterSec += seconds;
    }
  }

  const sortedMembers = [...members].sort((a, b) => {
    const achternaamCmp = (a.achternaam ?? '').localeCompare(b.achternaam ?? '', 'nl');
    if (achternaamCmp !== 0) return achternaamCmp;
    return (a.voornaam ?? '').localeCompare(b.voornaam ?? '', 'nl');
  });

  return sortedMembers.map((member) => {
    const t = totals.get(member.iddeelnemer) ?? emptyTotals();
    const achterwacht = secondsToDecimalHours(t.achterwachtSec);
    const dienst = secondsToDecimalHours(t.dienstSec);
    const extraDokter = secondsToDecimalHours(t.extraDokterSec);
    return {
      iddeelnemer: member.iddeelnemer,
      naam: formatDeelnemerNaam(member),
      initials: formatDeelnemerInitials(member),
      color: member.color?.trim() || '#cccccc',
      achterwacht,
      dienst,
      extraDokter,
      totaal: Math.round((achterwacht + dienst + extraDokter) * 100) / 100,
    };
  });
}
