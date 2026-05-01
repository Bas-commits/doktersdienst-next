import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTelRecords } from '@/tel-server-sync/generate-telrecords';
import type { query as dbQuery } from '@/lib/db';

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'telrecords-'));
  tempDirs.push(dir);
  return dir;
}

describe('generateTelRecords', () => {
  it('writes one normalized central-number text file per valid waarneemgroep', async () => {
    const outputDir = await makeTempDir();
    const queryMock = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'SELECT * FROM waarneemgroepen') {
        return {
          rows: [
            {
              id: 10,
              naam: 'Testgroep',
              telnronzecentrale2: '0880026406',
              telnrnietopgenomen: '06 11 11 11 11',
              idinvoegendewaarneemgroep: null,
              eigentelwelkomwav: false,
            },
            {
              id: 11,
              naam: 'Invalid',
              telnronzecentrale2: '12',
              telnrnietopgenomen: null,
              idinvoegendewaarneemgroep: null,
              eigentelwelkomwav: false,
            },
          ],
        };
      }

      expect(params).toEqual([10, 604900, 100]);
      return {
        rows: [
          {
            van: 1000,
            tot: 2000,
            type: 0,
            eigentelwelkomwav: false,
            iddeelnemer: 7,
            is_voicemail_doorschakeling: false,
            telnr1: '06 12 34 56 78',
            telnr2: null,
            telnr3: null,
            telnr4: null,
            telnr5: null,
          },
        ],
      };
    }) as unknown as typeof dbQuery;

    const records = await generateTelRecords({
      config: { tijdVooruit: 604800 },
      query: queryMock,
      outputDir,
      now: () => 100,
    });

    expect(records).toEqual([
      {
        nr: '0880026406',
        normalizedNr: '31880026406',
        file: join(outputDir, '31880026406.txt'),
        waarneemgroepId: 10,
        waarneemgroepNaam: 'Testgroep',
      },
    ]);
    await expect(readFile(join(outputDir, '31880026406.txt'), 'utf8')).resolves.toBe(
      'v3\n1000;2000;welkom-default_gsm;;31612345678~~0;2274396699;31611111111~~',
    );
  });

  it('removes stale txt files before dumping fresh records by default', async () => {
    const outputDir = await makeTempDir();
    await writeFile(join(outputDir, 'stale.txt'), 'old', 'utf8');
    const queryMock = vi.fn(async () => ({ rows: [] })) as unknown as typeof dbQuery;

    await generateTelRecords({
      config: { tijdVooruit: 604800 },
      query: queryMock,
      outputDir,
    });

    await expect(readFile(join(outputDir, 'stale.txt'), 'utf8')).rejects.toThrow();
  });
});
