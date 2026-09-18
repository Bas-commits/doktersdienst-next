import { describe, expect, it } from 'vitest';
import {
  generateAutoplanningProposal,
  type AutoplanningCandidate,
  type AutoplanningInput,
  type AutoplanningSlot,
} from '@/lib/autoplanning';

const HOUR = 3600;

function slot(id: string, van: number, tot: number): AutoplanningSlot {
  return { id, van, tot, section: 'middle' };
}

function baseInput(overrides: Partial<AutoplanningInput> = {}): AutoplanningInput {
  return {
    slots: [],
    candidates: [],
    absences: [],
    lieverNiet: [],
    otherSectionAssignments: [],
    existingHoursByMember: new Map(),
    totalExpectedHoursSoFar: 0,
    ...overrides,
  };
}

describe('generateAutoplanningProposal — hard uitsluiting', () => {
  it('sluit een afwezige kandidaat uit en wijst de resterende kandidaat toe', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 2 * HOUR)],
        candidates,
        absences: [{ iddeelnemer: 1, van: 0, tot: 2 * HOUR }],
        // Kandidaat 1 zit al ruim boven de helft van de groepsuren, kandidaat 2 ruim eronder —
        // zo blijft kandidaat 2 ook na deze toewijzing onder zijn verwachting (geen boven-fte),
        // en test dit uitsluitend de afwezigheids-uitsluiting.
        existingHoursByMember: new Map([
          [1, 100],
          [2, 0],
        ]),
        totalExpectedHoursSoFar: 100,
      }),
    );

    expect(result.unfilled).toEqual([]);
    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 2, warnings: [] },
    ]);
  });

  it('laat een slot onvervuld wanneer alle kandidaten afwezig zijn', () => {
    const candidates: AutoplanningCandidate[] = [{ iddeelnemer: 1, fte: 1 }];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 8 * HOUR)],
        candidates,
        absences: [{ iddeelnemer: 1, van: 0, tot: 8 * HOUR }],
      }),
    );

    expect(result.assignments).toEqual([]);
    expect(result.unfilled).toEqual(['s1']);
  });
});

describe('generateAutoplanningProposal — zachte constraints', () => {
  it('geeft de voorkeur aan de kandidaat die nog ruim onder zijn FTE-verwachting zit', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 2 * HOUR)],
        candidates,
        existingHoursByMember: new Map([
          [1, 0],
          [2, 30],
        ]),
        totalExpectedHoursSoFar: 30,
      }),
    );

    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 1, warnings: [] },
    ]);
  });

  it('markeert boven-fte wanneer de toewijzing de kandidaat boven zijn verwachting brengt', () => {
    // Kandidaat 1 telt mee voor de groepsverwachting (FTE, reeds gewerkte uren) maar is
    // afwezig voor dit slot, zodat alleen kandidaat 2 — die al ruim boven zijn eigen aandeel
    // zit — overblijft om aan toe te wijzen.
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 2 * HOUR)],
        candidates,
        absences: [{ iddeelnemer: 1, van: 0, tot: 2 * HOUR }],
        existingHoursByMember: new Map([
          [1, 0],
          [2, 30],
        ]),
        totalExpectedHoursSoFar: 30,
      }),
    );

    expect(result.assignments[0].warnings).toContain('boven-fte');
  });

  it('geeft de voorkeur aan de kandidaat zonder "liever niet" op dit tijdvak', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 8 * HOUR)],
        candidates,
        lieverNiet: [{ iddeelnemer: 2, van: 0, tot: 8 * HOUR }],
      }),
    );

    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 1, warnings: ['boven-fte'] },
    ]);
  });

  it('markeert liever-niet in de warnings van de gekozen kandidaat wanneer niemand anders kan', () => {
    const candidates: AutoplanningCandidate[] = [{ iddeelnemer: 2, fte: 1 }];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 8 * HOUR)],
        candidates,
        lieverNiet: [{ iddeelnemer: 2, van: 0, tot: 8 * HOUR }],
      }),
    );

    expect(result.assignments[0].warnings).toEqual(['liever-niet']);
  });

  it('geeft de voorkeur aan de kandidaat zonder overlappende toewijzing in een andere sectie', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 8 * HOUR)],
        candidates,
        otherSectionAssignments: [{ iddeelnemer: 2, van: 0, tot: 8 * HOUR }],
      }),
    );

    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 1, warnings: ['boven-fte'] },
    ]);
  });

  it('geeft de voorkeur aan de kandidaat zonder direct aansluitende dienst', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        // Kandidaat 2 heeft al een dienst die precies eindigt waar dit slot begint.
        slots: [slot('s1', 8 * HOUR, 16 * HOUR)],
        candidates,
        otherSectionAssignments: [{ iddeelnemer: 2, van: 0, tot: 8 * HOUR }],
      }),
    );

    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 1, warnings: ['boven-fte'] },
    ]);
  });
});

describe('generateAutoplanningProposal — eerlijke verdeling bij gelijke score', () => {
  it('kiest bij gelijke strafscore de kandidaat met de laagste FTE-ratio', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
      { iddeelnemer: 3, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('s1', 0, 2 * HOUR)],
        candidates,
        existingHoursByMember: new Map([
          [1, 10],
          [2, 14],
          [3, 100],
        ]),
        totalExpectedHoursSoFar: 124,
      }),
    );

    // Kandidaat 1 en 2 blijven beiden onder hun verwachting (geen boven-fte), kandidaat 3 niet —
    // tussen 1 en 2 wint wie verder onder zijn verwachting zit (kandidaat 1).
    expect(result.assignments).toEqual([
      { slotId: 's1', iddeelnemer: 1, warnings: [] },
    ]);
  });
});

describe('generateAutoplanningProposal — moeilijkste slot eerst', () => {
  it('vult het slot met de minste geschikte kandidaten ook als een ander slot eerder in de lijst staat', () => {
    const candidates: AutoplanningCandidate[] = [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ];
    const result = generateAutoplanningProposal(
      baseInput({
        slots: [slot('easy', 0, 2 * HOUR), slot('hard', 2 * HOUR, 4 * HOUR)],
        candidates,
        absences: [{ iddeelnemer: 2, van: 2 * HOUR, tot: 4 * HOUR }],
      }),
    );

    const hardAssignment = result.assignments.find((a) => a.slotId === 'hard');
    expect(hardAssignment?.iddeelnemer).toBe(1);
    expect(result.unfilled).toEqual([]);
  });
});
