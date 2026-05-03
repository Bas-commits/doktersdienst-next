import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

const mockGenerateTelRecords = vi.fn();

vi.mock('@/tel-server-sync/generate-telrecords', () => ({
  generateTelRecords: (...args: unknown[]) => mockGenerateTelRecords(...args),
}));

vi.mock('@/tel-server-sync/config', async () => {
  const actual = await vi.importActual<typeof import('@/tel-server-sync/config')>('@/tel-server-sync/config');
  return {
    ...actual,
    loadTelGenerationConfig: vi.fn(() => ({ tijdVooruit: 604800 })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function makeReq(): NextApiRequest {
  return {
    method: 'POST',
    headers: { cookie: 's=1' },
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
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 when there is no session', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(401);
    expect(mockGenerateTelRecords).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin', async () => {
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
    expect(mockGenerateTelRecords).not.toHaveBeenCalled();
  });

  it('runs generation for admins and returns count', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 1,
      email: 'adm@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    mockGenerateTelRecords.mockResolvedValue([
      {
        normalizedNr: '31880026406',
      },
      {
        normalizedNr: '31880026407',
      },
    ]);

    const { default: handler } = await import('@/pages/api/tel-sync/generate-telrecords');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, count: 2 });
    expect(mockGenerateTelRecords).toHaveBeenCalledWith({
      config: { tijdVooruit: 604800 },
    });
  });
});
