import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockFind = vi.fn();
const mockClaim = vi.fn();
const mockRelease = vi.fn();
const mockIsDev = vi.fn();
const mockLoadBird = vi.fn();
const mockSendBird = vi.fn();

vi.mock('@/lib/sms/dienst-begin', () => ({
  findDienstBeginCandidates: (...args: unknown[]) => mockFind(...args),
  claimDienstBeginSends: (...args: unknown[]) => mockClaim(...args),
  releaseDienstBeginClaims: (...args: unknown[]) => mockRelease(...args),
  isSmsDevelopmentMode: (...args: unknown[]) => mockIsDev(...args),
}));

vi.mock('@/lib/sms/bird', () => ({
  loadBirdSmsConfig: (...args: unknown[]) => mockLoadBird(...args),
  sendBirdSmsBatches: (...args: unknown[]) => mockSendBird(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: { minutes: 30 },
    ...overrides,
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 0,
    _json: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(payload: unknown) {
      this._json = payload;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { _status: number; _json: unknown };
}

describe('POST /api/sms/dienst-begin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.INTERNAL_TRIGGER_TOKEN = 'test-token';
    mockIsDev.mockReturnValue(false);
    mockFind.mockResolvedValue({ candidates: [], skipped: [] });
    mockClaim.mockImplementation(async (c: unknown[]) => c);
    mockLoadBird.mockReturnValue({ apiKey: 'bk_eu1_x', from: 'Doktersd' });
    mockSendBird.mockResolvedValue({ acceptedCount: 0, raw: null });
  });

  it('rejects missing bearer token', async () => {
    const handler = (await import('@/pages/api/sms/dienst-begin')).default;
    const res = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(res._status).toBe(401);
  });

  it('rejects invalid minutes', async () => {
    const handler = (await import('@/pages/api/sms/dienst-begin')).default;
    const res = makeRes();
    await handler(makeReq({ body: { minutes: 0 } }), res);
    expect(res._status).toBe(400);
  });

  it('dry-runs in development without calling Bird or claiming', async () => {
    mockIsDev.mockReturnValue(true);
    mockFind.mockResolvedValue({
      candidates: [
        {
          iddienst: 1,
          iddeelnemer: 100,
          voornaam: 'Anna',
          waarneemgroepNaam: 'Hap Noord',
          van: 1,
          tot: 2,
          toE164: '+31612345678',
          text: 'Beste Anna,\nUw dienst in Hap Noord begint om 17:00 en duurt tot 08:00',
        },
      ],
      skipped: [],
    });

    const handler = (await import('@/pages/api/sms/dienst-begin')).default;
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      ok: true,
      dryRun: true,
      selected: 1,
      sent: 0,
    });
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSendBird).not.toHaveBeenCalled();
    expect(mockLoadBird).not.toHaveBeenCalled();
  });

  it('claims and sends via Bird in production', async () => {
    const candidate = {
      iddienst: 7,
      iddeelnemer: 100,
      voornaam: 'Anna',
      waarneemgroepNaam: 'Hap Noord',
      van: 1,
      tot: 2,
      toE164: '+31612345678',
      text: 'Beste Anna,\nUw dienst in Hap Noord begint om 17:00 en duurt tot 08:00',
    };
    mockFind.mockResolvedValue({ candidates: [candidate], skipped: [] });
    mockClaim.mockResolvedValue([candidate]);
    mockSendBird.mockResolvedValue({ acceptedCount: 1, raw: null });

    const handler = (await import('@/pages/api/sms/dienst-begin')).default;
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, dryRun: false, sent: 1, selected: 1 });
    expect(mockClaim).toHaveBeenCalledOnce();
    expect(mockSendBird).toHaveBeenCalledOnce();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('releases claims when Bird fails', async () => {
    const candidate = {
      iddienst: 7,
      iddeelnemer: 100,
      voornaam: 'Anna',
      waarneemgroepNaam: 'Hap Noord',
      van: 1,
      tot: 2,
      toE164: '+31612345678',
      text: 'x',
    };
    mockFind.mockResolvedValue({ candidates: [candidate], skipped: [] });
    mockClaim.mockResolvedValue([candidate]);
    mockSendBird.mockRejectedValue(new Error('Bird down'));

    const handler = (await import('@/pages/api/sms/dienst-begin')).default;
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(502);
    expect(mockRelease).toHaveBeenCalledWith([7]);
  });
});
