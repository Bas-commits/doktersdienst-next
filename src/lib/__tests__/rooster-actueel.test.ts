import { describe, expect, it } from 'vitest';
import type { ShiftBlockView } from '@/types/diensten';
import { nuPositiePercentage, roosterActueelRijen, roosterActueelVenster } from '@/lib/rooster-actueel';

const pad = (n: number) => String(n).padStart(2, '0');
const lokaal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function blok(idwaarneemgroep: number, van: Date, tot: Date): ShiftBlockView {
  return {
    id: van.getTime() / 1000,
    day: van.getDate(),
    month: van.getMonth(),
    year: van.getFullYear(),
    van: van.getTime() / 1000,
    tot: tot.getTime() / 1000,
    startTime: `${pad(van.getHours())}:${pad(van.getMinutes())}`,
    endTime: `${pad(tot.getHours())}:${pad(tot.getMinutes())}`,
    currentDate: lokaal(van),
    nextDate: lokaal(tot),
    middle: { id: 1, name: 'Arts', shortName: 'AR', color: '#123456' },
    top: null,
    bottom: null,
    idwaarneemgroep,
  };
}

const dag = new Date(2026, 8, 30);
const groepen = [
  { id: 10, naam: '10 GGD-ZLND', telnronzecentrale: '0113249354' },
  { id: 73, naam: 'Verpleegkundigen FG Zeeland', telnronzecentrale: null },
  { id: 99, naam: 'Groep zonder diensten', telnronzecentrale: null },
];

describe('roosterActueelRijen', () => {
  it('geeft alleen groepen met een dienst op die dag een rij, in de volgorde van de groepen', () => {
    const blocks = [
      blok(73, new Date(2026, 8, 30, 8), new Date(2026, 8, 30, 17)),
      blok(10, new Date(2026, 8, 30, 17), new Date(2026, 8, 30, 23)),
      blok(10, new Date(2026, 9, 2, 8), new Date(2026, 9, 2, 17)),
    ];

    const { rijen, zonderDiensten } = roosterActueelRijen(blocks, groepen, dag);

    expect(rijen.map((r) => r.id)).toEqual([10, 73]);
    expect(rijen[0].segments).toHaveLength(1);
    expect(zonderDiensten.map((g) => g.id)).toEqual([99]);
  });

  it('toont een nachtdienst van de avond ervoor vanaf middernacht, doorlopend uit de vorige dag', () => {
    const nacht = blok(10, new Date(2026, 8, 29, 23), new Date(2026, 8, 30, 8));

    const { rijen } = roosterActueelRijen([nacht], groepen, dag);

    expect(rijen[0].segments[0]).toMatchObject({
      segmentStartTime: '00:00',
      segmentEndTime: '08:00',
      continuesFromPrev: true,
      continuesToNext: false,
    });
  });

  it('negeert diensten van groepen die de gebruiker niet heeft', () => {
    const vreemd = blok(11, new Date(2026, 8, 30, 8), new Date(2026, 8, 30, 17));

    const { rijen } = roosterActueelRijen([vreemd], groepen, dag);

    expect(rijen).toEqual([]);
  });
});

describe('roosterActueelVenster', () => {
  it('haalt ook een weekenddienst op die vrijdag begint en maandag eindigt', () => {
    const maandag = new Date(2026, 9, 5);
    const weekend = { van: new Date(2026, 9, 2, 17).getTime() / 1000, tot: new Date(2026, 9, 5, 8).getTime() / 1000 };

    const { vanGte, totLte } = roosterActueelVenster(maandag);

    expect(weekend.van).toBeGreaterThanOrEqual(vanGte);
    expect(weekend.tot).toBeLessThanOrEqual(totLte);
  });
});

describe('nuPositiePercentage', () => {
  it('zet 12:00 halverwege de dag', () => {
    expect(nuPositiePercentage(dag, new Date(2026, 8, 30, 12))).toBeCloseTo(50);
  });

  it('geeft null op een andere dag, zodat er dan geen nu-lijn staat', () => {
    expect(nuPositiePercentage(dag, new Date(2026, 9, 1, 12))).toBeNull();
  });
});
