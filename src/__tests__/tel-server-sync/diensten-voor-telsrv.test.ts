import { describe, expect, it, vi } from 'vitest';
import {
  buildTelServerText,
  pasGeaccepteerdeOvernamesToe,
  zetDienstenVoorTelSrvKlaar,
  type DienstTelSyncRow,
  type OvernemerTelRow,
  type WaarneemgroepForTelSync,
} from '@/tel-server-sync/diensten-voor-telsrv';
import type { TelSyncConfig } from '@/tel-server-sync/config';
import type { query as dbQuery } from '@/lib/db';

const wg: WaarneemgroepForTelSync = {
  id: 10,
  naam: 'Testgroep',
  telnronzecentrale2: '0880026406',
  telnrnietopgenomen: '06 11 11 11 11',
  idinvoegendewaarneemgroep: 20,
  eigentelwelkomwav: true,
};

const rows: DienstTelSyncRow[] = [
  {
    van: 100,
    tot: 200,
    type: 0,
    eigentelwelkomwav: true,
    iddeelnemer: 7,
    is_voicemail_doorschakeling: true,
    telnr1: '06 12 34 56 78',
    telnr2: '+31 6 87 65 43 21',
    telnr3: '',
    telnr4: null,
    telnr5: '1+234',
  },
  {
    van: 300,
    tot: 400,
    type: 5,
    eigentelwelkomwav: false,
    iddeelnemer: 8,
    is_voicemail_doorschakeling: null,
    telnr1: '0880026406',
    telnr2: null,
    telnr3: null,
    telnr4: null,
    telnr5: null,
  },
];

const config: TelSyncConfig = {
  syncOn: true,
  tijdVooruit: 604800,
  targets: [{ host: 'pbx.example.test', location: '/asterisk/receive_telnrs.php' }],
};

describe('tel-server-sync diensten payload', () => {
  it('builds the exact v3 payload shape from normal and achterwacht diensten', () => {
    expect(buildTelServerText(wg, rows, '31880026499')).toBe(
      [
        'v3',
        '100;200;welkom-dn-7_gsm;1;31612345678;31687654321',
        '~',
        '300;400;welkom-wg-10_gsm;;31880026406',
        '~',
        '0;2274396699;31611111111',
        '~',
        '31880026499',
        '~',
        'welkom-wg-10_gsm',
      ].join('\n'),
    );
  });

  it('posts the generated payload to every configured target', async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT telnronzecentrale2')) {
        return { rows: [{ telnronzecentrale2: '31880026499' }] };
      }
      return { rows };
    }) as unknown as typeof dbQuery;
    const sendServerComm = vi.fn(async () => ({ result: '1' }));

    await zetDienstenVoorTelSrvKlaar(wg, {
      config,
      query: queryMock,
      sendServerComm,
      now: () => 1000,
    });

    expect(sendServerComm).toHaveBeenCalledWith(config.targets[0], {
      nr: '0880026406',
      text: buildTelServerText(wg, rows, '31880026499'),
    });
  });

  it('logs a legacy error message when a target returns a non-success result', async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT telnronzecentrale2')) return { rows: [] };
      return { rows: [] };
    }) as unknown as typeof dbQuery;
    const logError = vi.fn();

    await zetDienstenVoorTelSrvKlaar(wg, {
      config,
      query: queryMock,
      sendServerComm: vi.fn(async () => ({ result: '0' })),
      logError,
    });

    expect(logError).toHaveBeenCalledWith('Kan telefoonnummers voor waarneemgroep Testgroep (0880026406) niet overzetten');
  });

  it('skips database and HTTP work when sync is disabled or the group number is invalid', async () => {
    const queryMock = vi.fn() as unknown as typeof dbQuery;
    const sendServerComm = vi.fn();

    await zetDienstenVoorTelSrvKlaar(wg, {
      config: { ...config, syncOn: false },
      query: queryMock,
      sendServerComm,
    });
    await zetDienstenVoorTelSrvKlaar({ ...wg, telnronzecentrale2: '12' }, { config, query: queryMock, sendServerComm });

    expect(queryMock).not.toHaveBeenCalled();
    expect(sendServerComm).not.toHaveBeenCalled();
  });
});

describe('tel-server-sync na een geaccepteerde overname', () => {
  const dienst = (over: Partial<DienstTelSyncRow>): DienstTelSyncRow => ({
    van: 1000,
    tot: 2000,
    type: 0,
    eigentelwelkomwav: false,
    iddeelnemer: 1398,
    is_voicemail_doorschakeling: null,
    telnr1: '0611111111',
    telnr2: null,
    telnr3: null,
    telnr4: null,
    telnr5: null,
    ...over,
  });
  // Zo komt een geaccepteerde overname uit de database: de oorspronkelijke arts en zijn nummers
  // in de rij zelf, de overnemer alleen als id.
  const overname = (over: Partial<DienstTelSyncRow>): DienstTelSyncRow =>
    dienst({ type: 6, dienst_status: 'accepted', dienst_iddeelnovern: 1397, ...over });
  const overnemers = new Map<number, OvernemerTelRow>([
    [1397, {
      iddeelnemer: 1397,
      eigentelwelkomwav: true,
      is_voicemail_doorschakeling: true,
      telnr1: '0622222222',
      telnr2: '0633333333',
      telnr3: null,
      telnr4: null,
      telnr5: null,
    }],
  ]);
  const plain = { ...wg, eigentelwelkomwav: false, telnrnietopgenomen: null };
  const secties = (rows: DienstTelSyncRow[]) =>
    buildTelServerText(plain, rows).split('\n~\n').map((sectie) => sectie.replace(/^v3\n/, ''));

  it('belt tijdens een volledige overname de overnemer, niet de oorspronkelijke arts', () => {
    const [diensten] = secties(pasGeaccepteerdeOvernamesToe([dienst({}), overname({})], overnemers));

    // Voorheen stonden hier twee regels, allebei met het nummer van 1398.
    expect(diensten).toBe('1000;2000;welkom-dn-1397_gsm;1;31622222222;31633333333');
  });

  it('laat de oorspronkelijke arts voor en na een gedeeltelijke overname staan', () => {
    const [diensten] = secties(
      pasGeaccepteerdeOvernamesToe([dienst({}), overname({ van: 1200, tot: 1500 })], overnemers),
    );

    expect(diensten.split('\n')).toEqual([
      '1000;1200;welkom-default_gsm;;31611111111',
      '1200;1500;welkom-dn-1397_gsm;1;31622222222;31633333333',
      '1500;2000;welkom-default_gsm;;31611111111',
    ]);
  });

  it('vervangt bij een achterwachtovername de achterwacht en laat de dienst staan', () => {
    const rows = [
      dienst({ iddeelnemer: 1400, telnr1: '0644444444' }),
      dienst({ type: 5 }),
      overname({ dienst_overname_sectie: 'top' }),
    ];
    const [diensten, achterwacht] = secties(pasGeaccepteerdeOvernamesToe(rows, overnemers));

    expect(diensten).toBe('1000;2000;welkom-default_gsm;;31644444444');
    expect(achterwacht).toBe('1000;2000;welkom-dn-1397_gsm;1;31622222222;31633333333');
  });

  it('verandert niets bij een extra-dokterovername, want extra dokter zit niet in deze tekst', () => {
    const rows = [dienst({}), overname({ dienst_overname_sectie: 'bottom' })];

    expect(pasGeaccepteerdeOvernamesToe(rows, overnemers)).toEqual([dienst({})]);
  });

  it('raakt de dienst van een andere arts op hetzelfde tijdvak niet', () => {
    const [diensten] = secties(
      pasGeaccepteerdeOvernamesToe(
        [dienst({ iddeelnemer: 1400, telnr1: '0644444444' }), dienst({}), overname({})],
        overnemers,
      ),
    );

    expect(diensten.split('\n')).toEqual([
      '1000;2000;welkom-default_gsm;;31644444444',
      '1000;2000;welkom-dn-1397_gsm;1;31622222222;31633333333',
    ]);
  });

  it('houdt de oorspronkelijke arts als de overnemer niet te vinden is', () => {
    expect(pasGeaccepteerdeOvernamesToe([dienst({}), overname({ dienst_iddeelnovern: 9999 })], overnemers))
      .toEqual([dienst({})]);
  });

  it('geeft een dienst die twee keer is doorgegeven aan de laatste arts', () => {
    const verder = new Map(overnemers).set(1396, { ...overnemers.get(1397)!, iddeelnemer: 1396, telnr1: '0655555555', telnr2: null });
    const [diensten] = secties(
      pasGeaccepteerdeOvernamesToe(
        [dienst({}), overname({}), overname({ iddeelnemer: 1397, dienst_iddeelnovern: 1396 })],
        verder,
      ),
    );

    expect(diensten).toBe('1000;2000;welkom-dn-1396_gsm;1;31655555555');
  });

  it('negeert een overname die nog niet is geaccepteerd', () => {
    const rows = [dienst({}), dienst({ type: 6, dienst_status: null })];

    expect(pasGeaccepteerdeOvernamesToe(rows, overnemers)).toHaveLength(2);
  });

  it('zet de regels op begintijd, omdat de centrale de eerste actieve regel neemt', () => {
    const rows = [dienst({ van: 3000, tot: 4000 }), dienst({ van: 1000, tot: 2000 })];

    expect(pasGeaccepteerdeOvernamesToe(rows, overnemers).map((r) => r.van)).toEqual([1000, 3000]);
  });

  it('haalt de nummers van de overnemer op en stuurt de vervangen regel', async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT telnronzecentrale2')) return { rows: [] };
      if (sql.includes('FROM deelnemers AS dn')) return { rows: [...overnemers.values()] };
      return { rows: [dienst({}), overname({})] };
    }) as unknown as typeof dbQuery;
    const sendServerComm = vi.fn(async () => ({ result: '1' }));

    await zetDienstenVoorTelSrvKlaar({ ...plain, idinvoegendewaarneemgroep: null }, {
      config,
      query: queryMock,
      sendServerComm,
      now: () => 1000,
    });

    const sent = (sendServerComm.mock.calls[0] as unknown as [unknown, { text: string }])[1].text;
    expect(sent).toContain('1000;2000;welkom-dn-1397_gsm;1;31622222222;31633333333');
    expect(sent).not.toContain('31611111111');
  });
});
