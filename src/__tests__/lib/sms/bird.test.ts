import { describe, expect, it, vi } from 'vitest';
import {
  birdRegionFromApiKey,
  birdSmsBatchesUrl,
  loadBirdSmsConfig,
  sendBirdSmsBatches,
} from '@/lib/sms/bird';

describe('birdRegionFromApiKey', () => {
  it('reads eu1 from the key prefix', () => {
    expect(birdRegionFromApiKey('bk_eu1_abc')).toBe('eu1');
    expect(birdSmsBatchesUrl('bk_eu1_abc')).toBe('https://eu1.platform.bird.com/v1/sms/batches');
  });

  it('defaults to us1', () => {
    expect(birdRegionFromApiKey('bk_us1_abc')).toBe('us1');
    expect(birdRegionFromApiKey('other')).toBe('us1');
  });
});

describe('loadBirdSmsConfig', () => {
  it('requires both key and from', () => {
    expect(() => loadBirdSmsConfig({})).toThrow(/BIRD_API_KEY/);
    expect(() => loadBirdSmsConfig({ BIRD_API_KEY: 'bk_eu1_x' })).toThrow(/BIRD_SMS_FROM/);
    expect(loadBirdSmsConfig({ BIRD_API_KEY: 'bk_eu1_x', BIRD_SMS_FROM: 'Doktersd' })).toEqual({
      apiKey: 'bk_eu1_x',
      from: 'Doktersd',
    });
  });
});

describe('sendBirdSmsBatches', () => {
  it('posts to Bird and returns accepted_count', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 202,
      statusText: 'Accepted',
      text: async () => JSON.stringify({ summary: { accepted_count: 2 } }),
    });

    const result = await sendBirdSmsBatches({
      apiKey: 'bk_eu1_test',
      idempotencyKey: 'dienst-begin/1-2',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      messages: [
        {
          from: 'Doktersd',
          to: '+31611111111',
          text: 'Hi',
          category: 'transactional',
        },
        {
          from: 'Doktersd',
          to: '+31622222222',
          text: 'Hi',
          category: 'transactional',
        },
      ],
    });

    expect(result.acceptedCount).toBe(2);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/sms/batches');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('dienst-begin/1-2');
  });

  it('throws when Bird rejects the batch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 422,
      statusText: 'Unprocessable',
      text: async () => JSON.stringify({ message: 'SMSInvalidRecipient' }),
    });

    await expect(
      sendBirdSmsBatches({
        apiKey: 'bk_eu1_test',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        messages: [
          {
            from: 'Doktersd',
            to: '+31611111111',
            text: 'Hi',
            category: 'transactional',
          },
        ],
      }),
    ).rejects.toThrow(/422/);
  });
});
