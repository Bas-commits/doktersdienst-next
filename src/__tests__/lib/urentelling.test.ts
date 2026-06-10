import { describe, expect, it } from 'vitest';
import {
  aggregateUrentelling,
  classifyDienstCategory,
  clippedSeconds,
  collectUrentellingDetails,
  type UrentellingDienst,
  type UrentellingMember,
} from '@/lib/urentelling';

const HOUR = 3600;

const members: UrentellingMember[] = [
  { iddeelnemer: 1, achternaam: 'Jansen', voornaam: 'Anna', voorletterstussenvoegsel: null, color: '#ff0000' },
  { iddeelnemer: 2, achternaam: 'Pietersen', voornaam: 'Bert', voorletterstussenvoegsel: 'van', color: '#00ff00' },
  { iddeelnemer: 3, achternaam: 'Smit', voornaam: 'Chris', voorletterstussenvoegsel: null, color: null },
];

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

describe('aggregateUrentelling', () => {
  const windowStart = 1000;
  const windowEnd = 1000 + 24 * HOUR;

  it('shows all aangemeld members with zero hours when no shifts', () => {
    const rows = aggregateUrentelling([], members, windowStart, windowEnd);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.achterwacht === 0 && r.dienst === 0 && r.extraDokter === 0)).toBe(true);
  });

  it('attributes standaard, achterwacht and extra dokter hours', () => {
    const diensten: UrentellingDienst[] = [
      { iddeelnemer: 1, van: windowStart, tot: windowStart + 4 * HOUR, type: 0, status: null },
      { iddeelnemer: 2, van: windowStart, tot: windowStart + 2 * HOUR, type: 5, status: null },
      { iddeelnemer: 3, van: windowStart, tot: windowStart + HOUR, type: 11, status: null },
    ];

    const rows = aggregateUrentelling(diensten, members, windowStart, windowEnd);
    const jansen = rows.find((r) => r.iddeelnemer === 1)!;
    const pietersen = rows.find((r) => r.iddeelnemer === 2)!;
    const smit = rows.find((r) => r.iddeelnemer === 3)!;

    expect(jansen.dienst).toBe(4);
    expect(pietersen.achterwacht).toBe(2);
    expect(smit.extraDokter).toBe(1);
    expect(jansen.totaal).toBe(4);
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

    const rows = aggregateUrentelling(diensten, members, windowStart, windowEnd);
    expect(rows.find((r) => r.iddeelnemer === 1)!.dienst).toBe(2);
  });

  it('transfers accepted overname hours in dienst column', () => {
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

    const rows = aggregateUrentelling(diensten, members, windowStart, windowEnd);
    const jansen = rows.find((r) => r.iddeelnemer === 1)!;
    const pietersen = rows.find((r) => r.iddeelnemer === 2)!;

    expect(jansen.dienst).toBe(6);
    expect(pietersen.dienst).toBe(2);
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

    const rows = aggregateUrentelling(diensten, members, windowStart, windowEnd);
    expect(rows.every((r) => r.dienst === 0)).toBe(true);
  });

  it('sorts rows by achternaam then voornaam', () => {
    const rows = aggregateUrentelling([], members, windowStart, windowEnd);
    expect(rows.map((r) => r.naam)).toEqual([
      'Jansen, Anna',
      'Pietersen, Bert, van',
      'Smit, Chris',
    ]);
  });

  it('collects underlying shift details for export', () => {
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
    ];

    const details = collectUrentellingDetails(diensten, members, windowStart, windowEnd);
    expect(details).toHaveLength(3);
    expect(details[0]).toMatchObject({
      naam: 'Jansen, Anna',
      categorie: 'Dienst',
      uren: 4,
    });
    expect(details.find((d) => d.categorie === 'Dienst (overname afgegeven)')).toMatchObject({
      naam: 'Jansen, Anna',
      uren: -1,
    });
    expect(details.find((d) => d.categorie === 'Dienst (overname ontvangen)')).toMatchObject({
      naam: 'Pietersen, Bert, van',
      uren: 1,
    });
  });

  it('includes initials and color on each row', () => {
    const rows = aggregateUrentelling([], members, windowStart, windowEnd);
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
