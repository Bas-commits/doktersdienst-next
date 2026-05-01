import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const { mockSignJwt, mockSendVerificationWithProof } = vi.hoisted(() => ({
  mockSignJwt: vi.fn(async () => 'signed-jwt-stub'),
  mockSendVerificationWithProof: vi.fn(async () => ({ resendEmailId: 're_test_1' })),
}));

vi.mock('better-auth/crypto', () => ({
  signJWT: mockSignJwt,
}));

vi.mock('@/lib/resend-email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/resend-email')>();
  return {
    ...actual,
    sendVerificationEmailViaResendWithProof: mockSendVerificationWithProof,
  };
});

const mockDupLimit = vi.fn(() => Promise.resolve([]));

const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: mockDupLimit,
    })),
  })),
}));

const mockReturning = vi.fn(() => Promise.resolve([{ id: 101 }]));
let txInsertCalls = 0;

const mockTxSelectLimit = vi.fn(() => Promise.resolve([] as { id: number }[]));

const mockTxSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    limit: mockTxSelectLimit,
    where: vi.fn(() => ({
      limit: mockTxSelectLimit,
    })),
  })),
}));

const mockTxInsert = vi.fn(() => {
  txInsertCalls += 1;
  if (txInsertCalls === 1) {
    return {
      values: vi.fn(() => ({
        returning: mockReturning,
      })),
    };
  }
  return {
    values: vi.fn(() => Promise.resolve(undefined)),
  };
});

const mockTransaction = vi.fn(
  async (
    cb: (tx: {
      execute: typeof mockTxExecute;
      insert: typeof mockTxInsert;
      select: typeof mockTxSelect;
    }) => Promise<number>
  ) => {
    txInsertCalls = 0;
    return cb({ execute: mockTxExecute, insert: mockTxInsert, select: mockTxSelect });
  }
);

const mockTxExecute = vi.fn(() => Promise.resolve(undefined));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  schema: {
    deelnemers: {},
    waarneemgroepdeelnemers: {},
  },
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: vi.fn(),
  hasGroupManagementAccess: vi.fn(),
}));

vi.mock('@/lib/deelnemer-nieuw', () => ({
  resolveDeelnemerCreatePermission: vi.fn(),
  listGroepChoicesForNewDeelnemer: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  or: vi.fn((...args: unknown[]) => args),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3005',
      origin: 'http://localhost:3005',
    },
    body: {
      email: 'nieuw@test.nl',
      voornaam: 'Jan',
      voorletterstussenvoegsel: '',
      achternaam: 'Tester',
      initialen: 'J.',
      huisadrtelnr: '0612345678',
      idgroep: 2,
      idwaarneemgroep: 9,
      inviteInitiatedOrigin: 'http://localhost:3005',
    },
    ...overrides,
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

describe('POST /api/deelnemers/nieuw', () => {
  beforeEach(async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'unit-test-secret');
    vi.clearAllMocks();
    mockDupLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: 101 }]);
    mockTxSelectLimit.mockResolvedValue([{ id: 101 }]);
    mockSendVerificationWithProof.mockResolvedValue({ resendEmailId: 're_test_1' });
    mockSignJwt.mockResolvedValue('signed-jwt-stub');
    mockTransaction.mockImplementation(async (cb) => {
      txInsertCalls = 0;
      return cb({ execute: mockTxExecute, insert: mockTxInsert, select: mockTxSelect });
    });

    const nieuwAcl = await import('@/lib/deelnemer-nieuw');
    const apiAuth = await import('@/lib/api-auth');

    vi.mocked(nieuwAcl.resolveDeelnemerCreatePermission).mockResolvedValue({ ok: true });
    vi.mocked(nieuwAcl.listGroepChoicesForNewDeelnemer).mockResolvedValue([
      { id: 1, naam: 'Deelnemer' },
      { id: 2, naam: 'Secretaris' },
    ]);
    vi.mocked(apiAuth.getAuthenticatedUser).mockResolvedValue({
      id: 1,
      email: 'secretaris@test.nl',
      idgroep: 2,
      isAdmin: false,
    });
    vi.mocked(apiAuth.hasGroupManagementAccess).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 405 for GET', async () => {
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when niet ingelogd', async () => {
    const apiAuth = await import('@/lib/api-auth');
    vi.mocked(apiAuth.getAuthenticatedUser).mockResolvedValueOnce(null);
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(401);
  });

  it('returns 403 when permissie-account ontbreekt (deelnemertoev / rol)', async () => {
    const nieuwAcl = await import('@/lib/deelnemer-nieuw');
    vi.mocked(nieuwAcl.resolveDeelnemerCreatePermission).mockResolvedValueOnce({
      ok: false,
      forbiddenReason: 'Geen rechten',
    });
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Geen rechten' });
  });

  it('returns 403 zonder waarneemgroep-beheer (hasGroupManagementAccess)', async () => {
    const apiAuth = await import('@/lib/api-auth');
    vi.mocked(apiAuth.hasGroupManagementAccess).mockResolvedValueOnce(false);
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(403);
    expect(res._json).toEqual({
      error: 'Geen beheer rechten voor de gekozen waarneemgroep.',
    });
  });

  it('returns 422 bij bestaande login/e-mail (pre-check)', async () => {
    mockDupLimit.mockResolvedValueOnce([{ id: 1 }]);

    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(422);
    expect((res._json as { error: string }).error).toMatch(/e‑mailadres/i);
    expect(mockSendVerificationWithProof).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 502 en geen db-transaction wanneer Resend-proof mislukt', async () => {
    mockSendVerificationWithProof.mockRejectedValueOnce(new Error('Resend unavailable'));

    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(502);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 when inviteInitiatedOrigin niet overeenkomt met Host/Origin', async () => {
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(
      makeReq({
        body: {
          ...(makeReq().body as Record<string, unknown>),
          inviteInitiatedOrigin: 'https://phishing.example',
        },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect((res._json as { error: string }).error).toMatch(/komt niet overeen/);
    expect(mockSendVerificationWithProof).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 422 bij database unique violation (23505) na succesvolle mail', async () => {
    mockTransaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(422);
    expect((res._json as { error: string }).error).toMatch(/e‑mailadres/i);
    expect(mockSendVerificationWithProof).toHaveBeenCalledTimes(1);
  });

  it('vindt id via fallback wanneer returning leeg geen bruikbare id heeft', async () => {
    mockReturning.mockResolvedValueOnce([]);
    mockTxSelectLimit
      .mockResolvedValueOnce([{ id: 777 }])
      .mockResolvedValueOnce([{ id: 777 }]);

    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, iddeelnemer: 777 });
    expect(mockSendVerificationWithProof).toHaveBeenCalledTimes(1);
  });

  it('maakt deelnemer aan en stuurt verificatiemail (Resend-proof eerst)', async () => {
    const { default: handler } = await import('@/pages/api/deelnemers/nieuw/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      ok: true,
      iddeelnemer: 101,
    });
    expect(typeof (res._json as { message: string }).message).toBe('string');
    expect(mockSendVerificationWithProof).toHaveBeenCalledTimes(1);
    const verificationCall = mockSendVerificationWithProof.mock.calls[0]?.[0] as
      | { url?: string }
      | undefined;
    expect(verificationCall?.url).toMatch(/^https?:\/\/.+\/api\/auth\/verify-email\?token=/);
    expect(verificationCall?.url).toContain(
      encodeURIComponent('/api/invite/na-verificatie')
    );
    expect(mockTxInsert).toHaveBeenCalledTimes(2);
  });
});
