import { describe, expect, it } from 'vitest';
import {
  commitmentLevelFromRatio,
  computeCommitmentCell,
  computeUrentellingCommitment,
  type UrentellingColumn,
  type UrentellingRow,
} from '@/lib/urentelling';

describe('commitmentLevelFromRatio', () => {
  it('maps thresholds to green, orange and red', () => {
    expect(commitmentLevelFromRatio(0.79)).toBe('green');
    expect(commitmentLevelFromRatio(0.8)).toBe('orange');
    expect(commitmentLevelFromRatio(1)).toBe('orange');
    expect(commitmentLevelFromRatio(1.01)).toBe('red');
  });
});

describe('computeCommitmentCell', () => {
  it('returns none when total FTE is zero', () => {
    expect(computeCommitmentCell(10, 30, 0, 1)).toEqual({
      ratio: null,
      level: 'none',
      expectedHours: null,
    });
  });

  it('returns none when member FTE is zero', () => {
    expect(computeCommitmentCell(10, 30, 2, 0)).toEqual({
      ratio: null,
      level: 'none',
      expectedHours: null,
    });
  });

  it('returns none when expected hours are zero', () => {
    expect(computeCommitmentCell(0, 0, 2, 1)).toEqual({
      ratio: null,
      level: 'none',
      expectedHours: 0,
    });
  });

  it('computes fair-share expected hours and ratio', () => {
    const cell = computeCommitmentCell(20, 30, 2, 1);
    expect(cell.expectedHours).toBe(15);
    expect(cell.ratio).toBeCloseTo(1.333, 3);
    expect(cell.level).toBe('red');
  });
});

describe('computeUrentellingCommitment', () => {
  const columns: UrentellingColumn[] = [
    { id: 10, tekst: 'Avond' },
    { id: 20, tekst: 'Dag' },
  ];

  it('assigns green, orange and red per column and totaal', () => {
    const rows: UrentellingRow[] = [
      {
        iddeelnemer: 1,
        naam: 'Alice',
        initials: 'AA',
        color: '#000',
        fte: 1,
        urenPerAantekening: [20, 0],
        achterwachtPerAantekening: [0, 0],
        totaalDienst: 20,
        totaalAchterwacht: 0,
      },
      {
        iddeelnemer: 2,
        naam: 'Bob',
        initials: 'BB',
        color: '#111',
        fte: 1,
        urenPerAantekening: [10, 20],
        achterwachtPerAantekening: [0, 0],
        totaalDienst: 30,
        totaalAchterwacht: 0,
      },
    ];

    const result = computeUrentellingCommitment(columns, rows, [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 1 },
    ]);

    expect(result.totalFte).toBe(2);
    expect(result.perRow[0][0].level).toBe('red');
    expect(result.perRow[1][0].level).toBe('green');
    expect(result.perRow[0][1].level).toBe('green');
    expect(result.perRow[1][1].level).toBe('red');
    expect(result.perRow[0][2].level).toBe('orange');
    expect(result.perRow[1][2].level).toBe('red');
  });

  it('weights expected hours by member FTE', () => {
    const rows: UrentellingRow[] = [
      {
        iddeelnemer: 1,
        naam: 'Alice',
        initials: 'AA',
        color: '#000',
        fte: 1,
        urenPerAantekening: [15],
        achterwachtPerAantekening: [0],
        totaalDienst: 15,
        totaalAchterwacht: 0,
      },
      {
        iddeelnemer: 2,
        naam: 'Bob',
        initials: 'BB',
        color: '#111',
        fte: 0.5,
        urenPerAantekening: [15],
        achterwachtPerAantekening: [0],
        totaalDienst: 15,
        totaalAchterwacht: 0,
      },
    ];

    const singleColumn: UrentellingColumn[] = [{ id: 10, tekst: 'Avond' }];
    const result = computeUrentellingCommitment(singleColumn, rows, [
      { iddeelnemer: 1, fte: 1 },
      { iddeelnemer: 2, fte: 0.5 },
    ]);

    expect(result.totalFte).toBe(1.5);
    expect(result.perRow[0][0].expectedHours).toBe(20);
    expect(result.perRow[0][0].level).toBe('green');
    expect(result.perRow[1][0].expectedHours).toBe(10);
    expect(result.perRow[1][0].level).toBe('red');
  });

  it('returns empty perRow when there are no rows', () => {
    const result = computeUrentellingCommitment(columns, [], []);
    expect(result.totalFte).toBe(0);
    expect(result.perRow).toEqual([]);
  });
});
