import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

let currentDeelnemer: { id: number | null; idgroep: number | null } | null = { id: 1, idgroep: 2 };
type WaarneemgroepenApiRow = {
  wg: { id: number; naam: string; afgemeld: boolean };
  wgdIdgroep?: number | null;
  wgdIddeelnemer?: number | null;
};
let waarneemgroepRows: WaarneemgroepenApiRow[] = [];
/** De taaktypen die als dienst zijn aangemerkt, waar plantDiensten uit volgt. */
let dienstTaakRows: { idwaarneemgroep: number | null }[] = [];

// Op tabel en niet op volgorde: het handler doet de groepen en de taaktypen naast elkaar in
// een Promise.all, dus welke select als eerste binnenkomt ligt niet vast.
const selectMock = vi.fn(() => ({
  from: vi.fn((tabel: unknown) => {
    if (tabel === schemaMock.deelnemers) {
      return {
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(currentDeelnemer ? [currentDeelnemer] : [])),
        })),
      };
    }
    if (tabel === schemaMock.taaktypen) {
      return { where: vi.fn(() => Promise.resolve(dienstTaakRows)) };
    }
    return {
      where: vi.fn(() => Promise.resolve(waarneemgroepRows)),
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(waarneemgroepRows)),
      })),
    };
  }),
}));

const schemaMock = {
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
  taaktypen: {
    idwaarneemgroep: 'taaktypen.idwaarneemgroep',
    isDienst: 'taaktypen.isDienst',
    verwijderd: 'taaktypen.verwijderd',
  },
};

vi.mock('@/db', () => ({
  db: {
    select: selectMock,
  },
  schema: schemaMock,
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
  isNull: vi.fn((a: unknown) => ['isNull', a]),
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
    currentDeelnemer = { id: 1, idgroep: 2 };
    waarneemgroepRows = [];
    dienstTaakRows = [];
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
        { id: 10, naam: 'Groep A', afgemeld: false, idgroep: 5, plantDiensten: false },
        { id: 20, naam: 'Groep B', afgemeld: false, idgroep: 5, plantDiensten: false },
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
      waarneemgroepen: [
        { id: 10, naam: 'Eigen groep', afgemeld: false, idgroep: 2, plantDiensten: false },
      ],
    });
  });

  it('markeert de groepen die een taaktype als dienst hebben aangemerkt', async () => {
    // Hier hangt de naam van de menuoptie Afwezigheidsplanner van af; zie dokterMenuItems.
    currentDeelnemer = { id: 1, idgroep: 5 };
    waarneemgroepRows = [
      { wg: { id: 10, naam: 'Groep A', afgemeld: false } },
      { wg: { id: 20, naam: 'Groep B', afgemeld: false } },
    ];
    dienstTaakRows = [{ idwaarneemgroep: 20 }, { idwaarneemgroep: 20 }];

    const { default: handler } = await import('@/pages/api/waarneemgroepen');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._json).toEqual({
      waarneemgroepen: [
        { id: 10, naam: 'Groep A', afgemeld: false, idgroep: 5, plantDiensten: false },
        { id: 20, naam: 'Groep B', afgemeld: false, idgroep: 5, plantDiensten: true },
      ],
    });
  });
});
