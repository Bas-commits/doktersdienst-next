import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockTransaction = vi.fn();
let selectResult: { id: number; login: string | null; idgroep: number | null }[] = [];

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  GROEP_ADMINISTRATOR: 5,
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(selectResult)),
        })),
      })),
    })),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  schema: {
    deelnemers: {},
    waarneemgroepdeelnemers: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

const adminUser = { id: 1, email: 'admin@test.nl', idgroep: 5, isAdmin: true };
const secretarisUser = { id: 2, email: 'sec@test.nl', idgroep: 2, isAdmin: false };

function makeReq(body: Record<string, unknown>): NextApiRequest {
  return {
    method: 'POST',
    headers: { cookie: 's=1' },
    body,
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

describe('POST /api/deelnemers/verwijderen', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        execute: vi.fn(() => Promise.resolve(undefined)),
      };
      await fn(tx);
    });
    vi.resetModules();
  });

  it('returns 403 when user is not admin', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    const { default: handler } = await import('@/pages/api/deelnemers/verwijderen');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 99 }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/beheerders/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 when admin tries to delete own account', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    const { default: handler } = await import('@/pages/api/deelnemers/verwijderen');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 1 }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/eigen account/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 when deelnemer does not exist', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    selectResult = [];
    const { default: handler } = await import('@/pages/api/deelnemers/verwijderen');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 999 }), res);

    expect(res._status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 when target is another administrator', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    selectResult = [{ id: 3, login: 'other@test.nl', idgroep: 5 }];
    const { default: handler } = await import('@/pages/api/deelnemers/verwijderen');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 3 }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/beheerder/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 200 and runs transaction when delete is allowed', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    selectResult = [{ id: 10, login: 'kill@test.nl', idgroep: 1 }];
    const { default: handler } = await import('@/pages/api/deelnemers/verwijderen');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 10 }), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
