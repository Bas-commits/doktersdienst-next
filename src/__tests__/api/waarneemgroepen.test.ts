import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

let selectCall = 0;
let currentDeelnemer: { id: number | null; idgroep: number | null } | null = { id: 1, idgroep: 2 };
type WaarneemgroepenApiRow = {
  wg: { id: number; naam: string; afgemeld: boolean };
  wgdIdgroep?: number | null;
  wgdIddeelnemer?: number | null;
};
let waarneemgroepRows: WaarneemgroepenApiRow[] = [];

const selectMock = vi.fn(() => {
  selectCall += 1;
  if (selectCall === 1) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(currentDeelnemer ? [currentDeelnemer] : [])),
        })),
      })),
    };
  }

  return {
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(waarneemgroepRows)),
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(waarneemgroepRows)),
      })),
    })),
  };
});

vi.mock('@/db', () => ({
  db: {
    select: selectMock,
  },
  schema: {
    deelnemers: { id: 'deelnemers.id', email: 'deelnemers.email', idgroep: 'deelnemers.idgroep' },
    waarneemgroepen: {
      id: 'waarneemgroepen.id',
      naam: 'waarneemgroepen.naam',
      afgemeld: 'waarneemgroepen.afgemeld',
      idregio: 'waarneemgroepen.idregio',
    },
    waarneemgroepdeelnemers: {
      aangemeld: 'waarneemgroepdeelnemers.aangemeld',
      iddeelnemer: 'waarneemgroepdeelnemers.iddeelnemer',
      idwaarneemgroep: 'waarneemgroepdeelnemers.idwaarneemgroep',
      idgroep: 'waarneemgroepdeelnemers.idgroep',
    },
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
  or: vi.fn((...args: unknown[]) => args),
}));

function makeReq(query: Record<string, string> = {}): NextApiRequest {
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

describe('GET /api/waarneemgroepen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCall = 0;
    currentDeelnemer = { id: 1, idgroep: 2 };
    waarneemgroepRows = [];
    mockGetSession.mockResolvedValue({
      user: { email: 'user@test.nl', id: '1' },
    });
    vi.resetModules();
  });

  it('returns all active waarneemgroepen for administrators', async () => {
    currentDeelnemer = { id: 1, idgroep: 5 };
    waarneemgroepRows = [
      { wg: { id: 10, naam: 'Groep A', afgemeld: false } },
      { wg: { id: 20, naam: 'Groep B', afgemeld: false } },
    ];

    const { default: handler } = await import('@/pages/api/waarneemgroepen');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      waarneemgroepen: [
        { id: 10, naam: 'Groep A', afgemeld: false, idgroep: 5 },
        { id: 20, naam: 'Groep B', afgemeld: false, idgroep: 5 },
      ],
    });
  });

  it('returns only scoped waarneemgroepen for non-admin users', async () => {
    waarneemgroepRows = [
      {
        wg: { id: 10, naam: 'Eigen groep', afgemeld: false },
        wgdIdgroep: 2,
        wgdIddeelnemer: 1,
      },
    ];

    const { default: handler } = await import('@/pages/api/waarneemgroepen');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({
      waarneemgroepen: [{ id: 10, naam: 'Eigen groep', afgemeld: false, idgroep: 2 }],
    });
  });
});
