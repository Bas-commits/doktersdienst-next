import { describe, expect, it, vi } from 'vitest';
import {
  buildTelServerText,
  zetDienstenVoorTelSrvKlaar,
  type DienstTelSyncRow,
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
        '100;200;welkom-dn-7_gsm;1;31612345678;31687654321~300;400;welkom-wg-10_gsm;;31880026406~0;2274396699;31611111111~31880026499~welkom-wg-10_gsm',
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
