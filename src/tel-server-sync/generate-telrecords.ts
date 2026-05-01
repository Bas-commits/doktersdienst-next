import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '@/lib/logger';
import { loadTelSyncConfig, type TelSyncConfig } from './config';
import { loadTelServerSyncEnv, telRecordsDir } from './env';
import {
  buildTelServerRecordForWaarneemgroep,
  type TelServerRecord,
  type WaarneemgroepForTelSync,
} from './diensten-voor-telsrv';
import type { query as dbQuery } from '@/lib/db';

type OutputDir = string | URL;

export type GeneratedTelRecord = {
  nr: string;
  normalizedNr: string;
  file: string;
  waarneemgroepId: number | null;
  waarneemgroepNaam: string | null;
};

export type GenerateTelRecordsOptions = {
  config?: Pick<TelSyncConfig, 'tijdVooruit'>;
  query?: typeof dbQuery;
  outputDir?: OutputDir;
  now?: () => number;
  clean?: boolean;
};

function toDirectoryUrl(outputDir: OutputDir): URL {
  if (outputDir instanceof URL) return outputDir;
  return pathToFileURL(outputDir.endsWith('/') ? outputDir : `${outputDir}/`);
}

function recordFileUrl(outputDir: URL, record: Pick<TelServerRecord, 'normalizedNr'>): URL {
  return new URL(`${record.normalizedNr}.txt`, outputDir);
}

async function cleanExistingRecords(outputDir: URL): Promise<void> {
  const entries = await readdir(outputDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
      .map((entry) => rm(new URL(entry.name, outputDir))),
  );
}

async function resolveQuery(query: typeof dbQuery | undefined): Promise<typeof dbQuery> {
  if (query) return query;
  const db = await import('@/lib/db');
  return db.query;
}

export async function generateTelRecords(options: GenerateTelRecordsOptions = {}): Promise<GeneratedTelRecord[]> {
  const config = options.config ?? loadTelSyncConfig();
  const outputDir = toDirectoryUrl(options.outputDir ?? telRecordsDir);
  const query = await resolveQuery(options.query);

  await mkdir(outputDir, { recursive: true });
  if (options.clean !== false) {
    await cleanExistingRecords(outputDir);
  }

  const result = await query<WaarneemgroepForTelSync>('SELECT * FROM waarneemgroepen');
  const generated: GeneratedTelRecord[] = [];

  for (const wg of result.rows) {
    const record = await buildTelServerRecordForWaarneemgroep(wg, {
      tijdVooruit: config.tijdVooruit,
      query,
      now: options.now,
    });

    if (!record) continue;

    const file = recordFileUrl(outputDir, record);
    await writeFile(file, record.text, 'utf8');
    generated.push({
      nr: record.nr,
      normalizedNr: record.normalizedNr,
      file: fileURLToPath(file),
      waarneemgroepId: record.waarneemgroep.id,
      waarneemgroepNaam: record.waarneemgroep.naam,
    });
  }

  return generated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadTelServerSyncEnv();

  generateTelRecords()
    .then((records) => {
      logger.info({ count: records.length, outputDir: telRecordsDir.pathname }, 'PBX telrecords generated');
    })
    .catch((error) => {
      logger.error({ error }, 'PBX telrecord generation failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      const db = await import('@/lib/db');
      await db.closePool();
    });
}
