import { logger } from '@/lib/logger';
import { loadTelServerSyncConfig, type TelSyncConfig } from './config';
import { sendServerComm as defaultSendServerComm } from './http';
import { getTelnr } from './phone';
import type { query as defaultQuery } from '@/lib/db';

type DbQuery = typeof defaultQuery;

export type WaarneemgroepForTelSync = {
  id: number | null;
  naam: string | null;
  telnronzecentrale2: string | null;
  telnrnietopgenomen: string | null;
  idinvoegendewaarneemgroep: number | null;
  eigentelwelkomwav: boolean | null;
};

export type DienstTelSyncRow = {
  van: number | null;
  tot: number | null;
  type: number | null;
  eigentelwelkomwav: boolean | null;
  iddeelnemer: number | null;
  is_voicemail_doorschakeling: boolean | number | string | null;
  telnr1: string | null;
  telnr2: string | null;
  telnr3: string | null;
  telnr4: string | null;
  telnr5: string | null;
};

type SendServerComm = typeof defaultSendServerComm;

export type ZetDienstenVoorTelSrvKlaarOptions = {
  config?: TelSyncConfig;
  query?: DbQuery;
  sendServerComm?: SendServerComm;
  now?: () => number;
  logError?: (message: string) => void;
};

export type TelServerRecord = {
  nr: string;
  normalizedNr: string;
  text: string;
  waarneemgroep: WaarneemgroepForTelSync;
};

function phpString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '1';
  return String(value);
}

function voicemailDoorschakelingString(value: DienstTelSyncRow['is_voicemail_doorschakeling']): string {
  if (value === null || value === undefined) return '';
  if (value === true) return '1';
  if (value === false) return '0';
  return String(value);
}

export function buildTelServerText(
  wg: WaarneemgroepForTelSync,
  rows: DienstTelSyncRow[],
  invoegendTelnr = '',
): string {
  const diensten: string[] = [];
  const awdiensten: string[] = [];

  for (const row of rows) {
    let welkom = '';
    if (row.eigentelwelkomwav) {
      welkom = `welkom-dn-${phpString(row.iddeelnemer)}_gsm`;
    } else if (wg.eigentelwelkomwav) {
      welkom = `welkom-wg-${phpString(wg.id)}_gsm`;
    } else {
      welkom = 'welkom-default_gsm';
    }

    let diensttext = `${phpString(row.van)};${phpString(row.tot)};${welkom};${phpString(
      voicemailDoorschakelingString(row.is_voicemail_doorschakeling),
    )}`;

    for (let i = 1; i <= 5; i += 1) {
      const nr = getTelnr(row[`telnr${i}` as keyof Pick<DienstTelSyncRow, 'telnr1' | 'telnr2' | 'telnr3' | 'telnr4' | 'telnr5'>]);
      if (nr) diensttext += `;${nr}`;
    }

    if (row.type === 5) awdiensten.push(diensttext);
    else diensten.push(diensttext);
  }

  const nr = getTelnr(wg.telnrnietopgenomen);
  const avdienstentext = nr ? `0;2274396699;${nr}` : '';
  const welkomwav = wg.eigentelwelkomwav ? `welkom-wg-${phpString(wg.id)}_gsm` : '';

  return `v3\n${diensten.join('\n')}~${awdiensten.join('\n')}~${avdienstentext}~${invoegendTelnr}~${welkomwav}`;
}

async function getInvoegendTelnr(
  dbQuery: DbQuery,
  wg: WaarneemgroepForTelSync,
): Promise<string> {
  if (!wg.idinvoegendewaarneemgroep) return '';

  const result = await dbQuery<{ telnronzecentrale2: string | null }>(
    'SELECT telnronzecentrale2 FROM waarneemgroepen WHERE id = $1 LIMIT 1',
    [wg.idinvoegendewaarneemgroep],
  );

  return result.rows[0]?.telnronzecentrale2 ?? '';
}

async function getDienstRows(
  dbQuery: DbQuery,
  wgid: number,
  starttime: number,
  endtime: number,
): Promise<DienstTelSyncRow[]> {
  const result = await dbQuery<DienstTelSyncRow>(
    `
      SELECT
        d.van,
        d.tot,
        d.type,
        dn.eigentelwelkomwav,
        d.iddeelnemer,
        dn.is_voicemail_doorschakeling,
        s.*
      FROM diensten AS d
      LEFT JOIN deelnemers AS dn ON d.iddeelnemer = dn.id
      LEFT JOIN settelnrs AS s ON dn.idsettelnrdienst = s.id
      WHERE
        d.idwaarneemgroep = $1
        AND (d.type = 0 OR d.type = 6 OR d.type = 5)
        AND d.van < $2
        AND d.tot > $3
    `,
    [wgid, endtime, starttime],
  );

  return result.rows;
}

async function resolveQuery(query: DbQuery | undefined): Promise<DbQuery> {
  if (query) return query;
  const db = await import('@/lib/db');
  return db.query;
}

export async function buildTelServerRecordForWaarneemgroep(
  wg: WaarneemgroepForTelSync,
  options: {
    tijdVooruit: number;
    query?: DbQuery;
    now?: () => number;
  },
): Promise<TelServerRecord | null> {
  const normalizedNr = getTelnr(wg.telnronzecentrale2);
  if (!normalizedNr || wg.id === null) return null;

  const dbQuery = await resolveQuery(options.query);
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const starttime = now();
  const endtime = starttime + options.tijdVooruit;

  const [invoegendTelnr, rows] = await Promise.all([
    getInvoegendTelnr(dbQuery, wg),
    getDienstRows(dbQuery, wg.id, starttime, endtime),
  ]);

  return {
    nr: phpString(wg.telnronzecentrale2),
    normalizedNr,
    text: buildTelServerText(wg, rows, invoegendTelnr),
    waarneemgroep: wg,
  };
}

export async function zetDienstenVoorTelSrvKlaar(
  wg: WaarneemgroepForTelSync,
  options: ZetDienstenVoorTelSrvKlaarOptions = {},
): Promise<void> {
  const config = options.config ?? loadTelServerSyncConfig().telSync;
  if (!config.syncOn) return;

  const logError =
    options.logError ??
    ((message: string) => {
      logger.error(message);
    });
  const sendServerComm = options.sendServerComm ?? defaultSendServerComm;
  const record = await buildTelServerRecordForWaarneemgroep(wg, {
    tijdVooruit: config.tijdVooruit,
    query: options.query,
    now: options.now,
  });

  if (!record) return;

  const data = {
    text: record.text,
    nr: record.nr,
  };

  for (const target of config.targets) {
    const resultdata = await sendServerComm(target, data);
    if (String(resultdata.result) !== '1') {
      logError(`Kan telefoonnummers voor waarneemgroep ${phpString(wg.naam)} (${phpString(wg.telnronzecentrale2)}) niet overzetten`);
    }
  }
}
