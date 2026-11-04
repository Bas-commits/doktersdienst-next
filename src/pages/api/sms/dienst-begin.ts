import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';
import { loadBirdSmsConfig, sendBirdSmsBatches, type BirdSmsMessage } from '@/lib/sms/bird';
import {
  claimDienstBeginSends,
  findDienstBeginCandidates,
  isSmsDevelopmentMode,
  releaseDienstBeginClaims,
  type DienstBeginCandidate,
} from '@/lib/sms/dienst-begin';

const log = logger.child({ api: 'sms/dienst-begin' });

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

type DryRunMessage = {
  iddienst: number;
  iddeelnemer: number;
  to: string;
  text: string;
};

type SuccessData = {
  ok: true;
  dryRun: boolean;
  selected: number;
  sent: number;
  skipped: number;
  skippedDetails: { iddienst: number; iddeelnemer: number | null; reason: string }[];
  messages?: DryRunMessage[];
};

type ErrorData = { error: string };

function readBearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function parseMinutes(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { minutes?: unknown }).minutes;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < MIN_MINUTES || n > MAX_MINUTES) return null;
  return n;
}

function toBirdMessages(from: string, candidates: readonly DienstBeginCandidate[]): BirdSmsMessage[] {
  return candidates.map((c) => ({
    from,
    to: c.toE164,
    text: c.text,
    category: 'transactional' as const,
    options: { smart_encoding: true },
    reference: `dienst-begin/${c.iddienst}`,
    metadata: {
      iddienst: c.iddienst,
      iddeelnemer: c.iddeelnemer,
    },
  }));
}

/**
 * POST /api/sms/dienst-begin
 *
 * Texts doctors whose duty starts within `minutes`, for waarneemgroepen with
 * "SMS begin dienst" enabled and telefoonnummer 1 marked as SMS-capable.
 *
 * Auth: Authorization: Bearer <INTERNAL_TRIGGER_TOKEN>
 * Body: { "minutes": 30 }
 *
 * In development (NODE_ENV or NEXT_PUBLIC_NODE_ENV), Bird is not called and
 * nothing is written to sms_dienst_begin.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessData | ErrorData>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.INTERNAL_TRIGGER_TOKEN?.trim();
  const token = readBearerToken(req);
  if (!expected || !token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const minutes = parseMinutes(req.body);
  if (minutes == null) {
    return res.status(400).json({
      error: `Body must include integer "minutes" between ${MIN_MINUTES} and ${MAX_MINUTES}.`,
    });
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const dryRun = isSmsDevelopmentMode();

  try {
    const { candidates, skipped } = await findDienstBeginCandidates(nowUnix, minutes);

    if (dryRun) {
      log.info(
        { minutes, selected: candidates.length, skipped: skipped.length, dryRun: true },
        'SMS dienst-begin dry run (development)',
      );
      return res.status(200).json({
        ok: true,
        dryRun: true,
        selected: candidates.length,
        sent: 0,
        skipped: skipped.length,
        skippedDetails: skipped,
        messages: candidates.map((c) => ({
          iddienst: c.iddienst,
          iddeelnemer: c.iddeelnemer,
          to: c.toE164,
          text: c.text,
        })),
      });
    }

    let birdConfig: { apiKey: string; from: string };
    try {
      birdConfig = loadBirdSmsConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bird config missing';
      log.error({ err }, 'SMS dienst-begin missing Bird config');
      return res.status(500).json({ error: message });
    }

    const claimed = await claimDienstBeginSends(candidates);
    if (claimed.length === 0) {
      return res.status(200).json({
        ok: true,
        dryRun: false,
        selected: candidates.length,
        sent: 0,
        skipped: skipped.length,
        skippedDetails: skipped,
      });
    }

    const idempotencyKey = `dienst-begin/${[...claimed.map((c) => c.iddienst)].sort((a, b) => a - b).join('-')}`;

    try {
      const result = await sendBirdSmsBatches({
        apiKey: birdConfig.apiKey,
        messages: toBirdMessages(birdConfig.from, claimed),
        idempotencyKey,
      });

      log.info(
        {
          minutes,
          selected: candidates.length,
          sent: result.acceptedCount,
          skipped: skipped.length,
        },
        'SMS dienst-begin sent',
      );

      return res.status(200).json({
        ok: true,
        dryRun: false,
        selected: candidates.length,
        sent: result.acceptedCount,
        skipped: skipped.length,
        skippedDetails: skipped,
      });
    } catch (err) {
      await releaseDienstBeginClaims(claimed.map((c) => c.iddienst));
      log.error({ err, claimed: claimed.length }, 'SMS dienst-begin Bird send failed; claims released');
      const message = err instanceof Error ? err.message : 'Bird send failed';
      return res.status(502).json({
        error: message.length > 300 ? 'Bird SMS batch failed. See server logs.' : message,
      });
    }
  } catch (err) {
    log.error({ err, minutes }, 'SMS dienst-begin failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
