import { intervalsOverlap } from '@/hooks/useDienstenSchedule';
import { computeCommitmentCell } from '@/lib/urentelling';

export type AutoplanningSection = 'middle' | 'top' | 'bottom';

export type AutoplanningSlot = {
  id: string;
  van: number;
  tot: number;
  section: AutoplanningSection;
};

export type AutoplanningCandidate = {
  iddeelnemer: number;
  fte: number;
};

export type AutoplanningInterval = {
  iddeelnemer: number;
  van: number;
  tot: number;
};

export type AutoplanningWarning =
  | 'boven-fte'
  | 'liever-niet'
  | 'dubbele-sectie'
  | 'aaneengesloten';

export type AutoplanningAssignment = {
  slotId: string;
  iddeelnemer: number;
  warnings: AutoplanningWarning[];
};

export type AutoplanningInput = {
  /** type=1 slots zonder overlappende toewijzing in de gekozen periode. */
  slots: AutoplanningSlot[];
  /** Aangemelde leden van de waarneemgroep. */
  candidates: AutoplanningCandidate[];
  /** Afwezigheid (type=9 Vakantie, type=10 Nascholing) — hard uitgesloten. */
  absences: AutoplanningInterval[];
  /** "Liever niet" (type=2) — zachte penalty. */
  lieverNiet: AutoplanningInterval[];
  /**
   * Bestaande andere-sectie toewijzingen in de periode (bv. al Top toegewezen
   * terwijl dit slot Middle is), voor de dubbele-sectie-penalty.
   */
  otherSectionAssignments: AutoplanningInterval[];
  /** Reeds geroosterde uren per kandidaat vóór deze run, uit aggregateUrentelling. */
  existingHoursByMember: Map<number, number>;
  /** Som van alle expected-hours-bepalende uren over de groep vóór deze run. */
  totalExpectedHoursSoFar: number;
};

export type AutoplanningResult = {
  assignments: AutoplanningAssignment[];
  unfilled: string[];
};

const SLOT_PENALTY = {
  boven_fte: 10,
  liever_niet: 5,
  dubbele_sectie: 3,
  aaneengesloten: 1,
} as const;

function slotHours(slot: AutoplanningSlot): number {
  return (slot.tot - slot.van) / 3600;
}

function isAbsent(
  candidateId: number,
  slot: AutoplanningSlot,
  absences: AutoplanningInterval[],
): boolean {
  return absences.some(
    (a) => a.iddeelnemer === candidateId && intervalsOverlap(slot.van, slot.tot, a.van, a.tot),
  );
}

function hasLieverNiet(
  candidateId: number,
  slot: AutoplanningSlot,
  lieverNiet: AutoplanningInterval[],
): boolean {
  return lieverNiet.some(
    (l) => l.iddeelnemer === candidateId && intervalsOverlap(slot.van, slot.tot, l.van, l.tot),
  );
}

function hasDubbeleSectie(
  candidateId: number,
  slot: AutoplanningSlot,
  otherSectionAssignments: AutoplanningInterval[],
): boolean {
  return otherSectionAssignments.some(
    (o) => o.iddeelnemer === candidateId && intervalsOverlap(slot.van, slot.tot, o.van, o.tot),
  );
}

/** Grenst dit slot direct aan een bestaande of in deze run toegewezen dienst van deze kandidaat? */
function hasAaneengesloten(
  candidateId: number,
  slot: AutoplanningSlot,
  adjacentByMember: Map<number, AutoplanningInterval[]>,
): boolean {
  const intervals = adjacentByMember.get(candidateId);
  if (!intervals) return false;
  return intervals.some((i) => i.van === slot.tot || i.tot === slot.van);
}

type Scored = {
  candidate: AutoplanningCandidate;
  score: number;
  ratio: number;
  warnings: AutoplanningWarning[];
};

function scoreCandidate(
  candidate: AutoplanningCandidate,
  slot: AutoplanningSlot,
  input: AutoplanningInput,
  hoursByMember: Map<number, number>,
  totalExpectedHoursSoFar: number,
  totalFte: number,
  adjacentByMember: Map<number, AutoplanningInterval[]>,
): Scored {
  const warnings: AutoplanningWarning[] = [];
  let score = 0;

  const existingHours = hoursByMember.get(candidate.iddeelnemer) ?? 0;
  const tentativeHours = existingHours + slotHours(slot);
  const commitment = computeCommitmentCell(
    tentativeHours,
    totalExpectedHoursSoFar + slotHours(slot),
    totalFte,
    candidate.fte,
  );
  const ratio = commitment.ratio ?? 0;
  if (commitment.level === 'red') {
    warnings.push('boven-fte');
    score += SLOT_PENALTY.boven_fte;
  }

  if (hasLieverNiet(candidate.iddeelnemer, slot, input.lieverNiet)) {
    warnings.push('liever-niet');
    score += SLOT_PENALTY.liever_niet;
  }

  if (hasDubbeleSectie(candidate.iddeelnemer, slot, input.otherSectionAssignments)) {
    warnings.push('dubbele-sectie');
    score += SLOT_PENALTY.dubbele_sectie;
  }

  if (hasAaneengesloten(candidate.iddeelnemer, slot, adjacentByMember)) {
    warnings.push('aaneengesloten');
    score += SLOT_PENALTY.aaneengesloten;
  }

  return { candidate, score, ratio, warnings };
}

/**
 * Genereert een greedy roostervoorstel: moeilijkste slots (minste geschikte
 * kandidaten) eerst, per slot de kandidaat met de laagste strafscore — bij
 * gelijke score wint wie het verst onder zijn FTE-verwachting zit. Zuiver
 * functioneel, geen I/O; de aanroepende API-route haalt alle input al op.
 */
export function generateAutoplanningProposal(input: AutoplanningInput): AutoplanningResult {
  const totalFte = Math.round(
    input.candidates.reduce((sum, c) => sum + c.fte, 0) * 100,
  ) / 100;

  const hoursByMember = new Map(input.existingHoursByMember);
  let totalExpectedHoursSoFar = input.totalExpectedHoursSoFar;

  const adjacentByMember = new Map<number, AutoplanningInterval[]>();
  for (const interval of [...input.otherSectionAssignments]) {
    const list = adjacentByMember.get(interval.iddeelnemer) ?? [];
    list.push(interval);
    adjacentByMember.set(interval.iddeelnemer, list);
  }

  const remainingSlots = [...input.slots];
  const assignments: AutoplanningAssignment[] = [];
  const unfilled: string[] = [];

  while (remainingSlots.length > 0) {
    // Per ronde: bepaal voor elk resterend slot de geschikte (niet-afwezige) kandidaten,
    // en kies het slot met de minste opties — dat is het moeilijkst in te vullen.
    let hardestIndex = -1;
    let hardestEligible: AutoplanningCandidate[] = [];

    for (let i = 0; i < remainingSlots.length; i++) {
      const slot = remainingSlots[i];
      const eligible = input.candidates.filter(
        (c) => !isAbsent(c.iddeelnemer, slot, input.absences),
      );
      if (hardestIndex === -1 || eligible.length < hardestEligible.length) {
        hardestIndex = i;
        hardestEligible = eligible;
      }
    }

    const slot = remainingSlots[hardestIndex];
    remainingSlots.splice(hardestIndex, 1);

    if (hardestEligible.length === 0) {
      unfilled.push(slot.id);
      continue;
    }

    const scored = hardestEligible.map((c) =>
      scoreCandidate(
        c,
        slot,
        input,
        hoursByMember,
        totalExpectedHoursSoFar,
        totalFte,
        adjacentByMember,
      ),
    );

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.ratio - b.ratio;
    });

    const winner = scored[0];
    assignments.push({
      slotId: slot.id,
      iddeelnemer: winner.candidate.iddeelnemer,
      warnings: winner.warnings,
    });

    hoursByMember.set(
      winner.candidate.iddeelnemer,
      (hoursByMember.get(winner.candidate.iddeelnemer) ?? 0) + slotHours(slot),
    );
    totalExpectedHoursSoFar += slotHours(slot);

    const list = adjacentByMember.get(winner.candidate.iddeelnemer) ?? [];
    list.push({ iddeelnemer: winner.candidate.iddeelnemer, van: slot.van, tot: slot.tot });
    adjacentByMember.set(winner.candidate.iddeelnemer, list);
  }

  return { assignments, unfilled };
}
