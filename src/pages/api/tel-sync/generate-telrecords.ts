import { timingSafeEqual } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { runTelRecordRefreshNow } from '@/tel-server-sync/refresh-scheduler';

const log = logger.child({ api: 'tel-sync/generate-telrecords' });

type Data = { ok: true; count: number } | { error: string };

function readBearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function tokenMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isInternalTriggerAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.INTERNAL_TRIGGER_TOKEN?.trim();
  if (!expected) return false;
  const token = readBearerToken(req);
  if (!token) return false;
  return tokenMatches(expected, token);
}

/**
 * POST /api/tel-sync/generate-telrecords
 *
 * Regenerates PBX .txt telrecords for all waarneemgroepen.
 * Auth: global administrator session, or Authorization: Bearer <INTERNAL_TRIGGER_TOKEN>.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const internalOk = isInternalTriggerAuthorized(req);
  let initiatedBy: string | number = 'internal-trigger';

  if (!internalOk) {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Alleen beheerders kunnen PBX-telrecords genereren.' });
    }
    initiatedBy = user.id;
  }

  try {
    const records = await runTelRecordRefreshNow();

    log.info({ count: records.length, initiatedBy }, 'PBX telrecords generated via API');

    return res.status(200).json({ ok: true, count: records.length });
  } catch (err) {
    log.error({ err, initiatedBy }, 'PBX telrecords API generation failed');

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
