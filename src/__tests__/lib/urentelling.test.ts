import { describe, expect, it } from 'vitest';
import {
  aggregateUrentelling,
  buildUrentellingColumns,
  classifyDienstCategory,
  clippedSeconds,
  collectUrentellingDetails,
  resolveAantekeningId,
  type UrentellingAantekening,
  type UrentellingBaseSlot,
  type UrentellingDienst,
  type UrentellingMember,
} from '@/lib/urentelling';

const HOUR = 3600;

const members: UrentellingMember[] = [
  { iddeelnemer: 1, achternaam: 'Jansen', voornaam: 'Anna', voorletterstussenvoegsel: null, initialen: null, color: '#ff0000', fte: 1 },
  { iddeelnemer: 2, achternaam: 'Pietersen', voornaam: 'Bert', voorletterstussenvoegsel: 'van', initialen: null, color: '#00ff00', fte: 1 },
  { iddeelnemer: 3, achternaam: 'Smit', voornaam: 'Chris', voorletterstussenvoegsel: null, initialen: null, color: null, fte: 1 },
];

const aantekeningen: UrentellingAantekening[] = [
  { id: 10, tekst: 'Huisartsenpost', prio: 1 },
  { id: 20, tekst: 'Avond', prio: 2 },
];

const windowStart = 1000;
const windowEnd = 1000 + 24 * HOUR;

function baseSlot(
  van: number,
  tot: number,
  idaantekening: number | null,
): UrentellingBaseSlot {
  return { van, tot, idaantekening };
}

describe('clippedSeconds', () => {
  it('returns full duration when fully inside window', () => {
    expect(clippedSeconds(100, 200, 0, 300)).toBe(100);
  });

  it('clips at window start', () => {
    expect(clippedSeconds(50, 200, 100, 300)).toBe(100);
  });

  it('clips at window end', () => {
    expect(clippedSeconds(50, 250, 0, 200)).toBe(150);
  });

  it('returns 0 when no overlap', () => {
    expect(clippedSeconds(50, 100, 200, 300)).toBe(0);
  });
});

describe('classifyDienstCategory', () => {
  it('classifies standaard and legacy types as dienst', () => {
    expect(classifyDienstCategory(0, null)).toBe('dienst');
    expect(classifyDienstCategory(4, null)).toBe('dienst');
    expect(classifyDienstCategory(6, null)).toBe('dienst');
  });

  it('classifies achterwacht and extra dokter', () => {
    expect(classifyDienstCategory(5, null)).toBe('achterwacht');
    expect(classifyDienstCategory(11, null)).toBe('extraDokter');
  });

  it('classifies accepted overname separately', () => {
    expect(classifyDienstCategory(6, 'accepted')).toBe('overnameAccepted');
  });

  it('excludes pending and declined overnames', () => {
    expect(classifyDienstCategory(4, 'pending')).toBeNull();
    expect(classifyDienstCategory(4, 'declined')).toBeNull();
  });

  it('excludes slot and preference types', () => {
    expect(classifyDienstCategory(1, null)).toBeNull();
    expect(classifyDienstCategory(9, null)).toBeNull();
  });
});

describe('resolveAantekeningId', () => {
  it('resolves aantekening via overlapping base slot', () => {
    const baseSlots = [baseSlot(windowStart, windowStart + 8 * HOUR, 10)];
    const dienst = { van: windowStart, tot: windowStart + 4 * HOUR };
    expect(resolveAantekeningId(dienst, baseSlots)).toBe(10);
  });

  it('returns 0 when no base slot matches', () => {
    const baseSlots = [baseSlot(windowStart + 10 * HOUR, windowStart + 12 * HOUR, 10)];
    const dienst = { van: windowStart, tot: windowStart + 4 * HOUR };
    expect(resolveAantekeningId(dienst, baseSlots)).toBe(0);
  });
});

describe('buildUrentellingColumns', () => {
  it('orders columns by prio then tekst', () => {
    const columns = buildUrentellingColumns(aantekeningen, new Set());
    expect(columns.map((c) => c.id)).toEqual([10, 20]);
    expect(columns.map((c) => c.tekst)).toEqual(['Huisartsenpost', 'Avond']);
  });

  it('appends no-aantekening column when used', () => {
    const columns = buildUrentellingColumns(aantekeningen, new Set([0]));
    expect(columns.at(-1)).toEqual({ id: 0, tekst: '—' });
  });
});

describe('aggregateUrentelling', () => {
  const baseSlots = [
    baseSlot(windowStart, windowStart + 8 * HOUR, 10),
    baseSlot(windowStart + 8 * HOUR, windowStart + 16 * HOUR, 20),
  ];

  it('shows all aangemeld members with zero hours when no shifts', () => {
    const { columns, rows } = aggregateUrentelling(
      [],
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(columns.map((c) => c.id)).toEqual([10, 20]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.totaalDienst === 0 && r.totaalAchterwacht === 0)).toBe(true);
  });

  it('attributes dienst and achterwacht hours per aantekening', () => {
    const diensten: UrentellingDienst[] = [
      { iddeelnemer: 1, van: windowStart, tot: windowStart + 4 * HOUR, type: 0, status: null },
      { iddeelnemer: 1, van: windowStart + 8 * HOUR, tot: windowStart + 10 * HOUR, type: 0, status: null },
      { iddeelnemer: 2, van: windowStart, tot: windowStart + 2 * HOUR, type: 5, status: null },
      { iddeelnemer: 2, van: windowStart + 8 * HOUR, tot: windowStart + 9 * HOUR, type: 5, status: null },
    ];

    const { rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    const jansen = rows.find((r) => r.iddeelnemer === 1)!;
    const pietersen = rows.find((r) => r.iddeelnemer === 2)!;

    expect(jansen.urenPerAantekening).toEqual([4, 2]);
    expect(jansen.totaalDienst).toBe(6);
    expect(jansen.totaalAchterwacht).toBe(0);
    expect(pietersen.urenPerAantekening).toEqual([0, 0]);
    expect(pietersen.achterwachtPerAantekening).toEqual([2, 1]);
    expect(pietersen.totaalAchterwacht).toBe(3);
  });

  it('excludes extra dokter hours', () => {
    const diensten: UrentellingDienst[] = [
      { iddeelnemer: 3, van: windowStart, tot: windowStart + HOUR, type: 11, status: null },
    ];

    const { rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    const smit = rows.find((r) => r.iddeelnemer === 3)!;
    expect(smit.totaalDienst).toBe(0);
    expect(smit.totaalAchterwacht).toBe(0);
  });

  it('clips shift hours at window boundaries', () => {
    const diensten: UrentellingDienst[] = [
      {
        iddeelnemer: 1,
        van: windowStart - 2 * HOUR,
        tot: windowStart + 2 * HOUR,
        type: 0,
        status: null,
      },
    ];

    const { rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(rows.find((r) => r.iddeelnemer === 1)!.totaalDienst).toBe(2);
  });

  it('transfers accepted overname hours in dienst column per aantekening', () => {
    const diensten: UrentellingDienst[] = [
      {
        iddeelnemer: 1,
        van: windowStart,
        tot: windowStart + 8 * HOUR,
        type: 0,
        status: null,
      },
      {
        iddeelnemer: 1,
        iddeelnovern: 2,
        van: windowStart + 2 * HOUR,
        tot: windowStart + 4 * HOUR,
        type: 6,
        status: 'accepted',
      },
    ];

    const { rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    const jansen = rows.find((r) => r.iddeelnemer === 1)!;
    const pietersen = rows.find((r) => r.iddeelnemer === 2)!;

    expect(jansen.totaalDienst).toBe(6);
    expect(pietersen.totaalDienst).toBe(2);
  });

  it('attributes unmatched shifts to no-aantekening column', () => {
    const diensten: UrentellingDienst[] = [
      {
        iddeelnemer: 1,
        van: windowStart + 20 * HOUR,
        tot: windowStart + 22 * HOUR,
        type: 0,
        status: null,
      },
    ];

    const { columns, rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(columns.at(-1)).toEqual({ id: 0, tekst: '—' });
    expect(rows.find((r) => r.iddeelnemer === 1)!.totaalDienst).toBe(2);
  });

  it('ignores pending overnames', () => {
    const diensten: UrentellingDienst[] = [
      {
        iddeelnemer: 1,
        iddeelnovern: 2,
        van: windowStart,
        tot: windowStart + 4 * HOUR,
        type: 4,
        status: 'pending',
      },
    ];

    const { rows } = aggregateUrentelling(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(rows.every((r) => r.totaalDienst === 0)).toBe(true);
  });

  it('sorts rows by achternaam then voornaam', () => {
    const { rows } = aggregateUrentelling(
      [],
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(rows.map((r) => r.naam)).toEqual([
      'Jansen, Anna',
      'Pietersen, Bert, van',
      'Smit, Chris',
    ]);
  });

  it('collects underlying shift details for export with aantekening', () => {
    const diensten: UrentellingDienst[] = [
      { iddeelnemer: 1, van: windowStart, tot: windowStart + 4 * HOUR, type: 0, status: null },
      {
        iddeelnemer: 1,
        iddeelnovern: 2,
        van: windowStart + HOUR,
        tot: windowStart + 2 * HOUR,
        type: 6,
        status: 'accepted',
      },
      { iddeelnemer: 2, van: windowStart, tot: windowStart + 2 * HOUR, type: 5, status: null },
      { iddeelnemer: 3, van: windowStart, tot: windowStart + HOUR, type: 11, status: null },
    ];

    const details = collectUrentellingDetails(
      diensten,
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(details).toHaveLength(4);
    expect(details[0]).toMatchObject({
      naam: 'Jansen, Anna',
      categorie: 'Dienst',
      idaantekening: 10,
      aantekening: 'Huisartsenpost',
      uren: 4,
    });
    expect(details.find((d) => d.categorie === 'Dienst (overname afgegeven)')).toMatchObject({
      naam: 'Jansen, Anna',
      idaantekening: 10,
      aantekening: 'Huisartsenpost',
      uren: -1,
    });
    expect(details.find((d) => d.categorie === 'Dienst (overname ontvangen)')).toMatchObject({
      naam: 'Pietersen, Bert, van',
      idaantekening: 10,
      aantekening: 'Huisartsenpost',
      uren: 1,
    });
    expect(details.find((d) => d.categorie === 'Achterwacht')).toMatchObject({
      naam: 'Pietersen, Bert, van',
      idaantekening: 10,
      aantekening: 'Huisartsenpost',
      uren: 2,
    });
    expect(details.find((d) => d.categorie === 'Extra dokter')).toBeUndefined();
  });

  it('prefers initialen from mijn-gegevens on each row', () => {
    const { rows } = aggregateUrentelling(
      [],
      [{ ...members[0], initialen: 'A.J.' }],
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(rows.find((r) => r.iddeelnemer === 1)?.initials).toBe('A.J.');
  });

  it('includes initials and color on each row', () => {
    const { rows } = aggregateUrentelling(
      [],
      members,
      windowStart,
      windowEnd,
      baseSlots,
      aantekeningen,
    );
    expect(rows.find((r) => r.iddeelnemer === 1)).toMatchObject({
      initials: 'AJ',
      color: '#ff0000',
    });
    expect(rows.find((r) => r.iddeelnemer === 2)).toMatchObject({
      initials: 'BP',
      color: '#00ff00',
    });
    expect(rows.find((r) => r.iddeelnemer === 3)).toMatchObject({
      initials: 'CS',
      color: '#cccccc',
    });
  });
});
