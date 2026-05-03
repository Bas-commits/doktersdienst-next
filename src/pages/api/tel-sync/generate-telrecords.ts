import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { loadTelGenerationConfig } from '@/tel-server-sync/config';
import { generateTelRecords } from '@/tel-server-sync/generate-telrecords';

const log = logger.child({ api: 'tel-sync/generate-telrecords' });

type Data = { ok: true; count: number } | { error: string };

/**
 * POST /api/tel-sync/generate-telrecords
 *
 * Regenerates PBX .txt telrecords for all waarneemgroepen. Global administrators only.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Alleen beheerders kunnen PBX-telrecords genereren.' });
  }

  try {
    const records = await generateTelRecords({
      config: loadTelGenerationConfig(),
    });

    log.info({ count: records.length, initiatedBy: user.id }, 'PBX telrecords generated via API');

    return res.status(200).json({ ok: true, count: records.length });
  } catch (err) {
    log.error({ err, userId: user.id }, 'PBX telrecords API generation failed');

    const message =
      err instanceof Error
        ? err.message.startsWith('Missing required environment variable')
          ? 'Configuratie ontbreekt (TEL_SYNC_TIJD_VOORUIT).'
          : err.message
        : 'Genereren mislukt.';

    return res.status(500).json({
      error:
        message.length > 200 ? 'Genereren mislukt. Bekijk serverlogs voor detail.' : message,
    });
  }
}
