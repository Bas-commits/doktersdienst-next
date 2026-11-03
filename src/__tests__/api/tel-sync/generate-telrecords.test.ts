import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

const mockRunTelRecordRefreshNow = vi.fn();

vi.mock('@/tel-server-sync/refresh-scheduler', () => ({
  runTelRecordRefreshNow: (...args: unknown[]) => mockRunTelRecordRefreshNow(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function makeReq(headers: Record<string, string> = { cookie: 's=1' }): NextApiRequest {
  return {
    method: 'POST',
    headers,
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as NextApiResponse & { _status: number; _json: unknown };
}

describe('POST /api/tel-sync/generate-telrecords', () => {
  const previousToken = process.env.INTERNAL_TRIGGER_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.INTERNAL_TRIGGER_TOKEN = 'test-trigger-token';
  });

  afterEach(() => {
    if (previousToken === undefined) delete process.env.INTERNAL_TRIGGER_TOKEN;
    else process.env.INTERNAL_TRIGGER_TOKEN = previousToken;
  });

  it('returns 401 when there is no session and no valid token', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(401);
    expect(mockRunTelRecordRefreshNow).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin without token', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 2,
      email: 'sec@test.nl',
      idgroep: 2,
      isAdmin: false,
    });

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(403);
    expect(mockRunTelRecordRefreshNow).not.toHaveBeenCalled();
  });

  it('runs generation for admins and returns count', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 1,
      email: 'adm@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    mockRunTelRecordRefreshNow.mockResolvedValue([
      { normalizedNr: '31880026406' },
      { normalizedNr: '31880026407' },
    ]);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, count: 2 });
    expect(mockRunTelRecordRefreshNow).toHaveBeenCalledOnce();
    expect(mockGetAuthenticatedUser).toHaveBeenCalled();
  });

  it('accepts INTERNAL_TRIGGER_TOKEN bearer without a session', async () => {
    mockRunTelRecordRefreshNow.mockResolvedValue([{ normalizedNr: '31880026406' }]);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq({ authorization: 'Bearer test-trigger-token' }), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, count: 1 });
    expect(mockRunTelRecordRefreshNow).toHaveBeenCalledOnce();
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('rejects a wrong bearer token and falls back to session auth', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq({ authorization: 'Bearer wrong-token' }), res);

    expect(res._status).toBe(401);
    expect(mockGetAuthenticatedUser).toHaveBeenCalled();
    expect(mockRunTelRecordRefreshNow).not.toHaveBeenCalled();
  });
});
