import { pathToFileURL } from 'node:url';
import { logger } from '@/lib/logger';
import { loadTelServerSyncConfig } from './config';
import { sendSms } from './http';
import { zetDienstenVoorTelSrvKlaar, type WaarneemgroepForTelSync } from './diensten-voor-telsrv';

export async function sendTelnrs(): Promise<void> {
  logger.info('SEND_TELNRS: init');

  const config = loadTelServerSyncConfig();
  const { query } = await import('@/lib/db');
  const result = await query<WaarneemgroepForTelSync>('SELECT * FROM waarneemgroepen');

  for (const wg of result.rows) {
    await zetDienstenVoorTelSrvKlaar(wg, { config: config.telSync });
  }

  logger.info('SEND_TELNRS: sending SMS');
  process.stdout.write(`FUNCTION FINISHED!${config.telSync.syncOn ? '1' : ''}`);

  const sent = await sendSms(config.sms, config.sms.completionRecipient, config.sms.completionMessage);
  if (!sent) {
    logger.error('Kan afrondings-SMS voor Doktersdienst telefoonnummers overgezet niet versturen');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sendTelnrs()
    .catch((error) => {
      logger.error({ error }, 'SEND_TELNRS failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      const db = await import('@/lib/db');
      await db.closePool();
    });
}
