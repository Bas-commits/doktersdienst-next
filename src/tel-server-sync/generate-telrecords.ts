import { randomBytes } from 'node:crypto';
import { access, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '@/lib/logger';
import { loadTelSyncConfig, type TelSyncConfig } from './config';
import {
  buildTelServerRecordForWaarneemgroep,
  type TelServerRecord,
  type WaarneemgroepForTelSync,
} from './diensten-voor-telsrv';
import type { query as dbQuery } from '@/lib/db';

/** PBX TXT output dir, with repo-local dev fallback for easy inspection. */
export function getTelRecordsDir(): URL {
  const raw = typeof process.env.TEL_RECORDS_DIR === 'string' ? process.env.TEL_RECORDS_DIR.trim() : '';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const localDevDir = resolve(process.cwd(), 'data', 'telrecords');

  const toDirUrl = (dirPath: string): URL => {
    const abs = resolve(dirPath);
    return pathToFileURL(abs.endsWith('/') ? abs : `${abs}/`);
  };

  if (raw !== '') {
    // In local development we remap Docker-style /data mounts into the repo.
    if (isDevelopment && (raw === '/data' || raw.startsWith('/data/'))) {
      return toDirUrl(localDevDir);
    }
    return toDirUrl(raw);
  }

  if (isDevelopment) {
    return toDirUrl(localDevDir);
  }

  return new URL('telrecords/', new URL('.', import.meta.url));
}

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

/** Normalized directory path (no trailing slash) for rename operations. */
function directoryPathFromUrl(dir: URL): string {
  const p = fileURLToPath(dir);
  const trimmed = p.replace(/[/\\]+$/, '');
  return trimmed === '' ? p : trimmed;
}

/**
 * Replace `finalPath` with the fully populated `stagingPath` using directory renames on the same filesystem.
 * Readers of `finalPath` keep seeing the previous tree until the swap (two renames), instead of an empty dir during rebuild.
 */
async function publishStagedDirectory(stagingPath: string, finalPath: string): Promise<void> {
  const backupPath = `${finalPath}.previous`;
  await rm(backupPath, { recursive: true, force: true }).catch(() => {});

  let movedFinalToBackup = false;
  try {
    await access(finalPath);
    await rename(finalPath, backupPath);
    movedFinalToBackup = true;
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : '';
    if (code !== 'ENOENT') throw e;
  }

  try {
    await rename(stagingPath, finalPath);
  } catch (err) {
    if (movedFinalToBackup) {
      try {
        await rename(backupPath, finalPath);
      } catch {
        /* best-effort rollback */
      }
    }
    throw err;
  }

  void rm(backupPath, { recursive: true, force: true }).catch(() => {});
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
  const outputDir = toDirectoryUrl(options.outputDir ?? getTelRecordsDir());
  const query = await resolveQuery(options.query);

  const useAtomicPublish = options.clean !== false;
  let writeDirUrl = outputDir;
  let stagingPath: string | null = null;

  if (useAtomicPublish) {
    const finalPath = directoryPathFromUrl(outputDir);
    stagingPath = `${finalPath}.build.${process.pid}-${randomBytes(8).toString('hex')}`;
    await mkdir(stagingPath, { recursive: true });
    writeDirUrl = pathToFileURL(`${stagingPath}/`);
  } else {
    await mkdir(outputDir, { recursive: true });
    if (options.clean !== false) {
      await cleanExistingRecords(outputDir);
    }
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

    const stagingFile = recordFileUrl(writeDirUrl, record);
    await writeFile(stagingFile, record.text, 'utf8');
    const destinationUrl = recordFileUrl(outputDir, record);
    generated.push({
      nr: record.nr,
      normalizedNr: record.normalizedNr,
      file: fileURLToPath(destinationUrl),
      waarneemgroepId: record.waarneemgroep.id,
      waarneemgroepNaam: record.waarneemgroep.naam,
    });
  }

  if (useAtomicPublish && stagingPath !== null) {
    await publishStagedDirectory(stagingPath, directoryPathFromUrl(outputDir));
  }

  return generated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateTelRecords()
    .then((records) => {
      logger.info({ count: records.length, outputDir: getTelRecordsDir().pathname }, 'PBX telrecords generated');
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
