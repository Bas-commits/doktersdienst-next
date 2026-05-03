import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getTelRecordsDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses TEL_RECORDS_DIR when set', async () => {
    vi.stubEnv('TEL_RECORDS_DIR', '/var/custom/telrecords');
    const { getTelRecordsDir } = await import('@/tel-server-sync/generate-telrecords');

    expect(fileURLToPath(getTelRecordsDir()).replace(/[/\\]+$/, '')).toBe(resolve('/var/custom/telrecords'));
  });

  it('falls back next to tel-server-sync modules when unset', async () => {
    const { getTelRecordsDir } = await import('@/tel-server-sync/generate-telrecords');
    expect(fileURLToPath(getTelRecordsDir())).toMatch(/telrecords[/\\]?$/);
  });
});
