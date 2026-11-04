import { describe, expect, it } from 'vitest';
import {
  buildDienstBeginText,
  isLaterPartialOvername,
  isSmsDevelopmentMode,
  resolveDienstBeginCandidates,
  resolveOnDutyDeelnemerId,
  toBirdE164,
  type DienstBeginOvername,
  type DienstBeginPhone,
  type DienstBeginShift,
} from '@/lib/sms/dienst-begin';

const WG = 10;
const VAN = 1_700_000_000;
const TOT = VAN + 8 * 3600;

function shift(partial: Partial<DienstBeginShift> & Pick<DienstBeginShift, 'id' | 'iddeelnemer'>): DienstBeginShift {
  return {
    type: 0,
    van: VAN,
    tot: TOT,
    idwaarneemgroep: WG,
    waarneemgroepNaam: 'Hap Noord',
    ...partial,
  };
}

function overname(
  partial: Partial<DienstBeginOvername> &
    Pick<DienstBeginOvername, 'id' | 'iddeelnemer' | 'iddeelnovern'>,
): DienstBeginOvername {
  return {
    van: VAN,
    tot: TOT,
    idwaarneemgroep: WG,
    overnameSectie: null,
    waarneemgroepNaam: 'Hap Noord',
    ...partial,
  };
}

function phone(
  iddeelnemer: number,
  partial: Partial<DienstBeginPhone> = {},
): DienstBeginPhone {
  return {
    iddeelnemer,
    voornaam: `Dokter${iddeelnemer}`,
    telnr1: `06123456${String(iddeelnemer).padStart(2, '0').slice(-2)}`,
    smsontvanger1: true,
    ...partial,
  };
}

describe('resolveOnDutyDeelnemerId', () => {
  it('returns the assigned doctor when there is no overname', () => {
    expect(resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100 }), [])).toBe(100);
  });

  it('returns the overnemer when an accepted overname covers the start', () => {
    const onDuty = resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100 }), [
      overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200 }),
    ]);
    expect(onDuty).toBe(200);
  });

  it('walks a chain of overnames covering the start', () => {
    const onDuty = resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100 }), [
      overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200 }),
      overname({ id: 51, iddeelnemer: 200, iddeelnovern: 300 }),
    ]);
    expect(onDuty).toBe(300);
  });

  it('ignores an overname in a different lane', () => {
    const onDuty = resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100, type: 0 }), [
      overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, overnameSectie: 'top' }),
    ]);
    expect(onDuty).toBe(100);
  });

  it('applies an achterwacht overname only to type 5', () => {
    const onDuty = resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100, type: 5 }), [
      overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, overnameSectie: 'top' }),
    ]);
    expect(onDuty).toBe(200);
  });

  it('keeps the assigned doctor when the overname starts later', () => {
    const onDuty = resolveOnDutyDeelnemerId(shift({ id: 1, iddeelnemer: 100 }), [
      overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, van: VAN + 3600 }),
    ]);
    expect(onDuty).toBe(100);
  });
});

describe('isLaterPartialOvername', () => {
  it('is true when the overname starts mid-shift', () => {
    expect(
      isLaterPartialOvername(
        overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, van: VAN + 3600 }),
        [shift({ id: 1, iddeelnemer: 100 })],
      ),
    ).toBe(true);
  });

  it('is false when the overname starts at the same time as the shift', () => {
    expect(
      isLaterPartialOvername(
        overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, van: VAN }),
        [shift({ id: 1, iddeelnemer: 100 })],
      ),
    ).toBe(false);
  });
});

describe('buildDienstBeginText', () => {
  it('formats the Dutch message with Amsterdam wall times', () => {
    // 2023-11-14 17:00 and 2023-11-15 01:00 Europe/Amsterdam (CET, UTC+1)
    const van = 1700000000; // fixed fixture below via formatters
    const text = buildDienstBeginText('Anna', 'Hap Noord', van, van + 8 * 3600);
    expect(text).toMatch(/^Beste Anna,\nUw dienst in Hap Noord begint om \d{2}:\d{2} en duurt tot \d{2}:\d{2}$/);
    expect(text).toContain('Beste Anna,');
    expect(text).toContain('Uw dienst in Hap Noord begint om');
  });
});

describe('toBirdE164', () => {
  it('prefixes a normalized Dutch number with +', () => {
    expect(toBirdE164('0612345678')).toBe('+31612345678');
  });

  it('returns null for an invalid number', () => {
    expect(toBirdE164('abc')).toBeNull();
  });
});

describe('resolveDienstBeginCandidates', () => {
  it('texts the assigned doctor with a valid SMS-capable phone 1', () => {
    const phones = new Map([[100, phone(100, { voornaam: 'Anna', telnr1: '0612345678' })]]);
    const { candidates, skipped } = resolveDienstBeginCandidates(
      [shift({ id: 1, iddeelnemer: 100 })],
      [],
      [],
      [],
      phones,
    );
    expect(skipped).toEqual([]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      iddienst: 1,
      iddeelnemer: 100,
      toE164: '+31612345678',
      voornaam: 'Anna',
    });
    expect(candidates[0].text).toContain('Beste Anna,');
  });

  it('texts the overnemer when an overname covers the start', () => {
    const phones = new Map([
      [100, phone(100)],
      [200, phone(200, { voornaam: 'Bert', telnr1: '0687654321' })],
    ]);
    const covering = [overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200 })];
    const { candidates } = resolveDienstBeginCandidates(
      [shift({ id: 1, iddeelnemer: 100 })],
      [],
      covering,
      [],
      phones,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].iddeelnemer).toBe(200);
    expect(candidates[0].iddienst).toBe(1);
    expect(candidates[0].toE164).toBe('+31687654321');
  });

  it('adds a later partial overname as its own duty start', () => {
    const phones = new Map([
      [100, phone(100)],
      [200, phone(200, { voornaam: 'Bert', telnr1: '0687654321' })],
    ]);
    const later = overname({
      id: 50,
      iddeelnemer: 100,
      iddeelnovern: 200,
      van: VAN + 3600,
      tot: TOT,
    });
    const underlying = [shift({ id: 1, iddeelnemer: 100 })];
    const { candidates } = resolveDienstBeginCandidates(
      [],
      [later],
      [],
      underlying,
      phones,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      iddienst: 50,
      iddeelnemer: 200,
      van: VAN + 3600,
    });
  });

  it('does not double-text a covering overname as a later partial', () => {
    const phones = new Map([
      [100, phone(100)],
      [200, phone(200, { telnr1: '0687654321' })],
    ]);
    const covering = overname({ id: 50, iddeelnemer: 100, iddeelnovern: 200, van: VAN });
    const { candidates } = resolveDienstBeginCandidates(
      [shift({ id: 1, iddeelnemer: 100 })],
      [covering],
      [covering],
      [shift({ id: 1, iddeelnemer: 100 })],
      phones,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].iddienst).toBe(1);
    expect(candidates[0].iddeelnemer).toBe(200);
  });

  it('skips when phone 1 cannot receive SMS', () => {
    const phones = new Map([[100, phone(100, { smsontvanger1: false })]]);
    const { candidates, skipped } = resolveDienstBeginCandidates(
      [shift({ id: 1, iddeelnemer: 100 })],
      [],
      [],
      [],
      phones,
    );
    expect(candidates).toEqual([]);
    expect(skipped).toEqual([{ iddienst: 1, iddeelnemer: 100, reason: 'sms-not-enabled' }]);
  });

  it('skips invalid phone numbers so Bird never sees them', () => {
    const phones = new Map([[100, phone(100, { telnr1: 'not-a-number' })]]);
    const { candidates, skipped } = resolveDienstBeginCandidates(
      [shift({ id: 1, iddeelnemer: 100 })],
      [],
      [],
      [],
      phones,
    );
    expect(candidates).toEqual([]);
    expect(skipped[0]?.reason).toBe('invalid-phone');
  });
});

describe('isSmsDevelopmentMode', () => {
  it('is true when NODE_ENV is development', () => {
    expect(isSmsDevelopmentMode({ NODE_ENV: 'development' })).toBe(true);
  });

  it('is true when NEXT_PUBLIC_NODE_ENV is development', () => {
    expect(isSmsDevelopmentMode({ NODE_ENV: 'production', NEXT_PUBLIC_NODE_ENV: 'development' })).toBe(
      true,
    );
  });

  it('is false in production', () => {
    expect(isSmsDevelopmentMode({ NODE_ENV: 'production', NEXT_PUBLIC_NODE_ENV: 'production' })).toBe(
      false,
    );
  });
});
