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
  /** Overname rows (type 6) only. Aliased in the query so a settelnrs column cannot shadow them. */
  dienst_status?: string | null;
  dienst_iddeelnovern?: number | null;
  dienst_overname_sectie?: string | null;
};

/** Phone settings of a doctor who takes a shift over; the replacement line is built from these. */
export type OvernemerTelRow = Pick<
  DienstTelSyncRow,
  'eigentelwelkomwav' | 'is_voicemail_doorschakeling' | 'telnr1' | 'telnr2' | 'telnr3' | 'telnr4' | 'telnr5'
> & { iddeelnemer: number };

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

  const sections = [
    diensten.join('\n'),
    awdiensten.join('\n'),
    avdienstentext,
    invoegendTelnr,
    welkomwav,
  ];

  return `v3\n${sections.join('\n~\n')}`;
}

function isGeaccepteerdeOvername(row: DienstTelSyncRow): boolean {
  return row.type === 6 && (row.dienst_status ?? '').trim().toLowerCase() === 'accepted';
}

/**
 * Puts the doctor who took a shift over on the line the exchange calls.
 *
 * An accepted overname row keeps the original doctor in `iddeelnemer` (the one taking over is in
 * `iddeelnovern`), and this sync used to read every row through `iddeelnemer`. The text then held
 * the original doctor twice and the new one never, so the exchange kept calling the original doctor.
 *
 * Each accepted overname now cuts its period out of the original doctor's line in the same lane
 * (dienst, or achterwacht for `overname_sectie = 'top'`) and puts the new doctor's line there, with
 * their own numbers, greeting and voicemail setting. A partial overname leaves the original doctor
 * before and after it. Replacement lines can be cut again, so a shift passed on twice ends up with
 * the last doctor. Extra dokter is not part of this text at all, so its overnames change nothing.
 *
 * If the new doctor cannot be found the original line stays: calling the wrong doctor is bad, but
 * a gap in which nobody is called is worse. An overname without a line underneath still gets the
 * new doctor's line, because the overname itself says who is on call then.
 *
 * Lines come out ordered by start time. The exchange takes the first active line per section, and
 * the database gave no order.
 */
export function pasGeaccepteerdeOvernamesToe(
  rows: DienstTelSyncRow[],
  overnemers: ReadonlyMap<number, OvernemerTelRow>,
): DienstTelSyncRow[] {
  let lines = rows.filter((row) => !isGeaccepteerdeOvername(row));
  const overnames = rows
    .filter(isGeaccepteerdeOvername)
    .sort((a, b) => Number(a.van ?? 0) - Number(b.van ?? 0));

  for (const overname of overnames) {
    const sectie = (overname.dienst_overname_sectie ?? '').trim().toLowerCase();
    if (sectie === 'bottom') continue;
    const laneType = sectie === 'top' ? 5 : 0;
    const inLane = (row: DienstTelSyncRow) => (laneType === 5 ? row.type === 5 : row.type !== 5);

    const van = Number(overname.van ?? 0);
    const tot = Number(overname.tot ?? 0);
    const overnemer = overnemers.get(Number(overname.dienst_iddeelnovern ?? 0));
    if (!overnemer || tot <= van) continue;

    const next: DienstTelSyncRow[] = [];
    for (const line of lines) {
      const lineVan = Number(line.van ?? 0);
      const lineTot = Number(line.tot ?? 0);
      const covered =
        inLane(line) && line.iddeelnemer === overname.iddeelnemer && lineVan < tot && lineTot > van;
      if (!covered) {
        next.push(line);
        continue;
      }
      if (lineVan < van) next.push({ ...line, tot: van });
      if (lineTot > tot) next.push({ ...line, van: tot });
    }
    next.push({
      van,
      tot,
      type: laneType,
      iddeelnemer: overnemer.iddeelnemer,
      eigentelwelkomwav: overnemer.eigentelwelkomwav,
      is_voicemail_doorschakeling: overnemer.is_voicemail_doorschakeling,
      telnr1: overnemer.telnr1,
      telnr2: overnemer.telnr2,
      telnr3: overnemer.telnr3,
      telnr4: overnemer.telnr4,
      telnr5: overnemer.telnr5,
    });
    lines = next;
  }

  return lines.sort((a, b) => Number(a.van ?? 0) - Number(b.van ?? 0));
}

async function getOvernemers(
  dbQuery: DbQuery,
  rows: DienstTelSyncRow[],
): Promise<Map<number, OvernemerTelRow>> {
  const ids = [
    ...new Set(
      rows
        .filter(isGeaccepteerdeOvername)
        .map((row) => Number(row.dienst_iddeelnovern ?? 0))
        .filter((id) => id > 0),
    ),
  ];
  if (ids.length === 0) return new Map();

  const result = await dbQuery<OvernemerTelRow>(
    `
      SELECT
        dn.id AS iddeelnemer,
        dn.eigentelwelkomwav,
        dn.is_voicemail_doorschakeling,
        s.telnr1, s.telnr2, s.telnr3, s.telnr4, s.telnr5
      FROM deelnemers AS dn
      LEFT JOIN settelnrs AS s ON dn.idsettelnrdienst = s.id
      WHERE dn.id = ANY($1::int[])
    `,
    [ids],
  );
  return new Map(result.rows.map((row) => [Number(row.iddeelnemer), row]));
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
        s.*,
        d.status AS dienst_status,
        d.iddeelnovern AS dienst_iddeelnovern,
        d.overname_sectie AS dienst_overname_sectie
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
  const overnemers = await getOvernemers(dbQuery, rows);

  return {
    nr: phpString(wg.telnronzecentrale2),
    normalizedNr,
    text: buildTelServerText(wg, pasGeaccepteerdeOvernamesToe(rows, overnemers), invoegendTelnr),
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
