import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockHasDelegatedProfileAccess = vi.fn();
const mockPoolQuery = vi.fn();

const selectQueue: unknown[][] = [];
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(async () => selectQueue.shift() ?? []),
    })),
  })),
}));

const mockUpdateWhere = vi.fn(async () => []);
const mockUpdateSet = vi.fn(() => ({
  where: mockUpdateWhere,
}));
const mockUpdate = vi.fn(() => ({
  set: mockUpdateSet,
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

vi.mock('@/lib/mijn-gegevens-access', () => ({
  hasDelegatedProfileAccess: (...args: unknown[]) => mockHasDelegatedProfileAccess(...args),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  schema: {
    deelnemers: {},
    waarneemgroepen: {},
    waarneemgroepdeelnemers: {},
    groepen: {},
    locaties: {},
    instellingtype: {},
    settelnrs: {},
  },
}));

vi.mock('@/lib/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}));

vi.mock('@/lib/legacy-password', () => ({
  legacyMD5Hash: vi.fn((value: string) => `hashed-${value}`),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  and: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((a: unknown, b: unknown) => [a, b]),
  asc: vi.fn((a: unknown) => a),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

type TestResponse = NextApiResponse & { _status: number; _json: unknown };

function makeReq(
  method: 'GET' | 'PATCH',
  options: { query?: Record<string, string>; body?: unknown } = {}
): NextApiRequest {
  return {
    method,
    headers: { cookie: 's=1' },
    query: options.query ?? {},
    body: options.body,
  } as unknown as NextApiRequest;
}

function makeRes(): TestResponse {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(payload: unknown) {
      res._json = payload;
      return res;
    },
  };
  return res as unknown as TestResponse;
}

describe('/api/mijn-gegevens delegated profile editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectQueue.length = 0;

    mockGetAuthenticatedUser.mockResolvedValue({
      id: 10,
      email: 'sec@test.nl',
      idgroep: 2,
      isAdmin: false,
    });
    mockHasDelegatedProfileAccess.mockResolvedValue(true);
  });

  it('blocks delegated GET when secretaris has no access to target participant', async () => {
    mockHasDelegatedProfileAccess.mockResolvedValueOnce(false);
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(makeReq('GET', { query: { deelnemerId: '22' } }), res);

    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Geen toegang tot deze deelnemer' });
  });

  it('allows delegated PATCH when access exists and non-sensitive fields are sent', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { voornaam: 'Jan' },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true, loginUpdated: false });
  });

  it('rejects delegated PATCH attempts to change email or password', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { huisemail: 'new@example.com' },
      }),
      res
    );

    expect(res._status).toBe(403);
    expect(res._json).toEqual({
      error: 'E-mail en wachtwoord kunnen niet worden aangepast voor deze deelnemer',
    });
  });

  it('still allows self PATCH with huisemail updates', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();
    selectQueue.push([{ login: 'new@example.com' }]);

    await handler(
      makeReq('PATCH', {
        body: { huisemail: 'new@example.com' },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true, loginUpdated: false });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid phone fields on PATCH', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { huisadrtelnr: 'invalid-phone' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toEqual({
      error: 'Telefoonnummer is ongeldig. Gebruik bijvoorbeeld 0612345678, 31612345678 of +31612345678.',
    });
  });

  it('normalizes telnrSlots before storing them', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();
    selectQueue.push([{ idsettelnrdienst: 42 }]);

    await handler(
      makeReq('PATCH', {
        body: {
          telnrSlots: [
            {
              telnr: '06 12 34 56 78',
              idlocatietelnr: 1001,
              idomschrtelnr: 2,
              smsontvanger: false,
            },
          ],
        },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(mockPoolQuery).toHaveBeenCalled();
    const params = mockPoolQuery.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toBe('31612345678');
  });
});
