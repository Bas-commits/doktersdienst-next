import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

let selectCall = 0;

vi.mock('@/lib/api-auth', () => ({
  findDeelnemerBySessionEmail: vi.fn(() =>
    Promise.resolve({ id: 1, idgroep: 2 })
  ),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ idwaarneemgroep: 9 }])),
          })),
        };
      }
      if (selectCall === 2) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ iddeelnemer: 10 }])),
          })),
        };
      }
      if (selectCall === 3) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() =>
                Promise.resolve([
                  {
                    id: 10,
                    voornaam: 'Jan',
                    achternaam: 'Jansen',
                    login: 'jan@test.nl',
                    emailVerified: true,
                    echtedeelnemer: false,
                  },
                ])
              ),
            })),
          })),
        };
      }
      if (selectCall === 4) {
        return {
          from: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() =>
                Promise.resolve([
                  {
                    iddeelnemer: 10,
                    idwaarneemgroep: 9,
                    aangemeld: false,
                    idgroep: 1,
                    idfunctie: null,
                    naam: 'Groep A',
                  },
                ])
              ),
            })),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ iddeelnemer: 10 }])),
        })),
      };
    }),
  },
  schema: {
    deelnemers: {},
    waarneemgroepen: {},
    waarneemgroepdeelnemers: {},
  },
}));

const mockGetSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
  ne: vi.fn((a: unknown, b: unknown) => [a, b]),
  isNotNull: vi.fn((a: unknown) => a),
}));

function makeReq(query: Record<string, string>): NextApiRequest {
  return {
    method: 'GET',
    headers: { cookie: 's=1' },
    query,
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

describe('GET /api/deelnemers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectCall = 0;
    mockGetSession.mockResolvedValue({
      user: { email: 'sec@test.nl', id: '1' },
    });
    vi.resetModules();
  });

  it('returns 403 when idwaarneemgroep not in gebruiker memberships (niet-admin)', async () => {
    const { default: handler } = await import('@/pages/api/deelnemers/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '99' }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/waarneemgroep/i);
  });

  it('includes afgemelde memberships and membershipCount in beheer mode', async () => {
    selectCall = 0;
    const { default: handler } = await import('@/pages/api/deelnemers/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '9', beheer: '1' }), res);

    expect(res._status).toBe(200);
    const body = res._json as {
      deelnemers: {
        id: number;
        membershipCount?: number;
        waarneemgroepen: { aangemeld: boolean }[];
      }[];
    };
    expect(body.deelnemers).toHaveLength(1);
    expect(body.deelnemers[0]?.membershipCount).toBe(1);
    expect(body.deelnemers[0]?.waarneemgroepen[0]?.aangemeld).toBe(false);
  });
});
