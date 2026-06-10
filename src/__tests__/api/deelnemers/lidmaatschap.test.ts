import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockHasGroupManagementAccess = vi.fn();
const mockDeleteDeelnemerCompletely = vi.fn();
const mockTransaction = vi.fn();
const mockDelete = vi.fn();

let selectLimitCallCount = 0;
let selectResult: { id: number; login: string | null; idgroep: number | null }[] = [];
let membershipLimitResult: { id: number }[] = [];
let allMembershipsResult: { id: number }[] = [];

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  hasGroupManagementAccess: (...args: unknown[]) => mockHasGroupManagementAccess(...args),
  GROEP_ADMINISTRATOR: 5,
}));

vi.mock('@/lib/deelnemer-delete', () => ({
  deleteDeelnemerCompletely: (...args: unknown[]) => mockDeleteDeelnemerCompletely(...args),
  isPgFkViolation: () => false,
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            selectLimitCallCount += 1;
            if (selectLimitCallCount === 1) {
              return Promise.resolve(selectResult);
            }
            return Promise.resolve(membershipLimitResult);
          }),
        })),
      })),
    })),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  schema: {
    deelnemers: {},
    waarneemgroepdeelnemers: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
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

describe('POST /api/deelnemers/lidmaatschap', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectLimitCallCount = 0;
    selectResult = [{ id: 10, login: 'doc@test.nl', idgroep: 1 }];
    membershipLimitResult = [{ id: 100 }];
    allMembershipsResult = [{ id: 100 }, { id: 101 }];
    mockHasGroupManagementAccess.mockResolvedValue(true);
    mockDelete.mockReturnValue({
      where: vi.fn(() => Promise.resolve()),
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({});
    });
    vi.resetModules();

    const { db } = await import('@/db');
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          if (selectLimitCallCount < 2) {
            return {
              limit: vi.fn(() => {
                selectLimitCallCount += 1;
                if (selectLimitCallCount === 1) {
                  return Promise.resolve(selectResult);
                }
                return Promise.resolve(membershipLimitResult);
              }),
            };
          }
          return Promise.resolve(allMembershipsResult);
        }),
      })),
    }) as ReturnType<typeof db.select>);
  });

  it('returns 403 when user tries to delete own membership', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 2, idwaarneemgroep: 9 }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/eigen/i);
  });

  it('returns 403 when user lacks group management access', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    mockHasGroupManagementAccess.mockResolvedValue(false);
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 10, idwaarneemgroep: 9 }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/toegang/i);
  });

  it('deletes only membership when deelnemer has multiple groups', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    allMembershipsResult = [{ id: 100 }, { id: 101 }];
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 10, idwaarneemgroep: 9 }), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, volledigVerwijderd: false });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 on last membership without full-delete confirmation', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    allMembershipsResult = [{ id: 100 }];
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 10, idwaarneemgroep: 9 }), res);

    expect(res._status).toBe(400);
    expect((res._json as { error: string }).error).toMatch(/laatste lidmaatschap/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deletes membership when row exists but id column is null', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    membershipLimitResult = [{ id: null, iddeelnemer: 10, idwaarneemgroep: 9 }];
    allMembershipsResult = [{ id: null }, { id: 101 }];
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(makeReq({ iddeelnemer: 10, idwaarneemgroep: 9 }), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, volledigVerwijderd: false });
    expect(mockDelete).toHaveBeenCalled();
  });

  it('fully deletes deelnemer on last membership with confirmation', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(adminUser);
    allMembershipsResult = [{ id: 100 }];
    const { default: handler } = await import('@/pages/api/deelnemers/lidmaatschap');
    const res = makeRes();
    await handler(
      makeReq({ iddeelnemer: 10, idwaarneemgroep: 9, bevestigVolledigeVerwijdering: true }),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, volledigVerwijderd: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeleteDeelnemerCompletely).toHaveBeenCalledWith({}, 10, 'doc@test.nl');
  });
});
