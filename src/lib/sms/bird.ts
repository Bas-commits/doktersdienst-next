export type BirdSmsMessage = {
  from: string;
  to: string;
  text: string;
  category: 'transactional' | 'marketing' | 'authentication' | 'service';
  options?: { smart_encoding?: boolean };
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type BirdBatchResult = {
  acceptedCount: number;
  raw: unknown;
};

/** Derive Bird region from workspace key prefix (`bk_eu1_…` → `eu1`). */
export function birdRegionFromApiKey(apiKey: string): 'eu1' | 'us1' {
  const match = /^bk_(eu1|us1)_/i.exec(apiKey.trim());
  if (match?.[1]?.toLowerCase() === 'eu1') return 'eu1';
  return 'us1';
}

export function birdSmsBatchesUrl(apiKey: string): string {
  const region = birdRegionFromApiKey(apiKey);
  return `https://${region}.platform.bird.com/v1/sms/batches`;
}

const BATCH_LIMIT = 100;

export type SendBirdSmsBatchOptions = {
  apiKey: string;
  messages: BirdSmsMessage[];
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
};

/**
 * POST /v1/sms/batches. Chunks at 100 (Bird's max). Acceptance is all-or-nothing per chunk.
 */
export async function sendBirdSmsBatches(
  options: SendBirdSmsBatchOptions,
): Promise<BirdBatchResult> {
  const { apiKey, messages, idempotencyKey } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = birdSmsBatchesUrl(apiKey);

  let acceptedCount = 0;
  let lastRaw: unknown = null;

  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const chunk = messages.slice(i, i + BATCH_LIMIT);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      const part = Math.floor(i / BATCH_LIMIT);
      headers['Idempotency-Key'] =
        messages.length <= BATCH_LIMIT ? idempotencyKey : `${idempotencyKey}/p${part}`;
    }

    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: chunk }),
    });

    const bodyText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = bodyText;
    }
    lastRaw = parsed;

    if (response.status !== 202) {
      const detail =
        typeof parsed === 'object' && parsed && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : bodyText.slice(0, 500);
      throw new Error(`Bird SMS batch failed (${response.status}): ${detail || response.statusText}`);
    }

    const summary =
      typeof parsed === 'object' && parsed && 'summary' in parsed
        ? (parsed as { summary?: { accepted_count?: number } }).summary
        : undefined;
    acceptedCount += summary?.accepted_count ?? chunk.length;
  }

  return { acceptedCount, raw: lastRaw };
}

export function loadBirdSmsConfig(
  env: Record<string, string | undefined> = process.env,
): {
  apiKey: string;
  from: string;
} {
  const apiKey = env.BIRD_API_KEY?.trim();
  const from = env.BIRD_SMS_FROM?.trim();
  if (!apiKey) {
    throw new Error('Missing required environment variable: BIRD_API_KEY');
  }
  if (!from) {
    throw new Error('Missing required environment variable: BIRD_SMS_FROM');
  }
  return { apiKey, from };
}
