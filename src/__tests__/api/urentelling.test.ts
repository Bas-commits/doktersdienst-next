import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

let selectCall = 0;

const memberRows = [
  {
    iddeelnemer: 1,
    achternaam: 'Jansen',
    voornaam: 'Anna',
    voorletterstussenvoegsel: null,
    initialen: null,
    color: '#336699',
  },
];

const aantekeningRows = [{ id: 10, tekst: 'Huisartsenpost', prio: 1 }];

const baseSlotRows = [{ van: 1000, tot: 4600, idaantekening: 10 }];

const dienstRows = [
  {
    iddeelnemer: 1,
    iddeelnovern: null,
    van: 1000,
    tot: 4600,
    type: 0,
    status: null,
  },
];

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => Promise.resolve(memberRows)),
              })),
            })),
          })),
        };
      }
      if (selectCall === 2) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve(aantekeningRows)),
          })),
        };
      }
      if (selectCall === 3) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve(baseSlotRows)),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(dienstRows)),
        })),
      };
    }),
  },
  schema: {
    diensten: {},
    deelnemers: {},
    waarneemgroepdeelnemers: {},
    dienstaantekening: {},
  },
}));

const mockGetAuthenticatedUser = vi.fn();
const mockHasGroupManagementAccess = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  hasGroupManagementAccess: (...args: unknown[]) => mockHasGroupManagementAccess(...args),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((a: unknown) => a),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  gt: vi.fn((a: unknown, b: unknown) => [a, b]),
  isNull: vi.fn((a: unknown) => a),
  lt: vi.fn((a: unknown, b: unknown) => [a, b]),
  or: vi.fn((...args: unknown[]) => args),
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

describe('GET /api/urentelling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectCall = 0;
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 10,
      email: 'sec@test.nl',
      idgroep: 2,
      isAdmin: false,
    });
    mockHasGroupManagementAccess.mockResolvedValue(true);
    vi.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);
    const { default: handler } = await import('@/pages/api/urentelling/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '1', vanGte: '1000', totLte: '5000' }), res);

    expect(res._status).toBe(401);
  });

  it('returns 403 when user lacks group management access', async () => {
    mockHasGroupManagementAccess.mockResolvedValue(false);
    const { default: handler } = await import('@/pages/api/urentelling/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '1', vanGte: '1000', totLte: '5000' }), res);

    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toMatch(/toegang/i);
  });

  it('returns aggregated rows for valid request', async () => {
    const { default: handler } = await import('@/pages/api/urentelling/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '1', vanGte: '1000', totLte: '5000' }), res);

    expect(res._status).toBe(200);
    const body = res._json as {
      van: number;
      tot: number;
      columns: Array<{ id: number; tekst: string }>;
      rows: Array<{
        naam: string;
        initials: string;
        color: string;
        urenPerAantekening: number[];
        totaalDienst: number;
      }>;
      details: Array<{ naam: string; categorie: string; aantekening: string; uren: number }>;
    };
    expect(body.van).toBe(1000);
    expect(body.tot).toBe(5000);
    expect(body.columns).toEqual([{ id: 10, tekst: 'Huisartsenpost' }]);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].naam).toBe('Jansen, Anna');
    expect(body.rows[0].initials).toBe('AJ');
    expect(body.rows[0].color).toBe('#336699');
    expect(body.rows[0].urenPerAantekening).toEqual([1]);
    expect(body.rows[0].totaalDienst).toBe(1);
    expect(body.details).toHaveLength(1);
    expect(body.details[0]).toMatchObject({
      naam: 'Jansen, Anna',
      categorie: 'Dienst',
      idaantekening: 10,
      aantekening: 'Huisartsenpost',
      uren: 1,
    });
  });

  it('returns 400 when totLte is before vanGte', async () => {
    const { default: handler } = await import('@/pages/api/urentelling/index');
    const res = makeRes();
    await handler(makeReq({ idwaarneemgroep: '1', vanGte: '5000', totLte: '1000' }), res);

    expect(res._status).toBe(400);
  });
});
