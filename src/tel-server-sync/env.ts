import { config as loadDotenv } from 'dotenv';

export const telServerSyncDir = new URL('.', import.meta.url);
export const telServerSyncEnvPath = new URL('.env', telServerSyncDir);
export const telRecordsDir = new URL('telrecords/', telServerSyncDir);

export function loadTelServerSyncEnv(): void {
  loadDotenv({ path: telServerSyncEnvPath });
}
