import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const { mockSignJwt, mockSendVerificationWithProof } = vi.hoisted(() => ({
  mockSignJwt: vi.fn(async () => 'signed-jwt-stub'),
  mockSendVerificationWithProof: vi.fn(async () => ({ resendEmailId: 're_test_1' })),
}));

vi.mock('better-auth/crypto', () => ({
  signJWT: mockSignJwt,
}));

vi.mock('@/lib/resend-email', () => ({
  sendVerificationEmailViaResendWithProof: mockSendVerificationWithProof,
}));

let selectCall = 0;
let membershipRows: { id: number }[] = [{ id: 1 }];
let targetRows: Array<{
  id: number;
  login: string | null;
  email: string | null;
  name: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
  emailVerified: boolean | null;
}> = [];

const mockSelect = vi.fn(() => {
  selectCall += 1;
  const rows = selectCall === 1 ? membershipRows : targetRows;
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(rows)),
      })),
    })),
  };
});

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
  },
  schema: {
    deelnemers: {
      id: 'deelnemers.id',
      login: 'deelnemers.login',
      email: 'deelnemers.email',
      name: 'deelnemers.name',
      voornaam: 'deelnemers.voornaam',
      voorletterstussenvoegsel: 'deelnemers.voorletterstussenvoegsel',
      achternaam: 'deelnemers.achternaam',
      emailVerified: 'deelnemers.emailVerified',
    },
    waarneemgroepdeelnemers: {
      id: 'waarneemgroepdeelnemers.id',
      iddeelnemer: 'waarneemgroepdeelnemers.iddeelnemer',
      idwaarneemgroep: 'waarneemgroepdeelnemers.idwaarneemgroep',
      aangemeld: 'waarneemgroepdeelnemers.aangemeld',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: vi.fn(),
  hasGroupManagementAccess: vi.fn(),
}));

function makeReq(): NextApiRequest {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3005',
      origin: 'http://localhost:3005',
    },
    body: {
      iddeelnemer: 10,
      idwaarneemgroep: 9,
      inviteInitiatedOrigin: 'http://localhost:3005',
    },
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

describe('POST /api/deelnemers/verificatie-opnieuw', () => {
  beforeEach(async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'unit-test-secret');
    vi.clearAllMocks();
    selectCall = 0;
    membershipRows = [{ id: 1 }];
    targetRows = [
      {
        id: 10,
        login: 'nieuw@test.nl',
        email: 'nieuw@test.nl',
        name: 'Jan Tester',
        voornaam: 'Jan',
        voorletterstussenvoegsel: null,
        achternaam: 'Tester',
        emailVerified: false,
      },
    ];
    mockSignJwt.mockResolvedValue('signed-jwt-stub');
    mockSendVerificationWithProof.mockResolvedValue({ resendEmailId: 're_test_1' });

    const apiAuth = await import('@/lib/api-auth');
    vi.mocked(apiAuth.getAuthenticatedUser).mockResolvedValue({
      id: 1,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    vi.mocked(apiAuth.hasGroupManagementAccess).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 403 when the caller cannot manage the waarneemgroep', async () => {
    const apiAuth = await import('@/lib/api-auth');
    vi.mocked(apiAuth.hasGroupManagementAccess).mockResolvedValueOnce(false);

    const { default: handler } = await import('@/pages/api/deelnemers/verificatie-opnieuw');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(403);
    expect(mockSendVerificationWithProof).not.toHaveBeenCalled();
  });

  it('does not send mail when the email address is already verified', async () => {
    targetRows[0] = { ...targetRows[0], emailVerified: true };

    const { default: handler } = await import('@/pages/api/deelnemers/verificatie-opnieuw');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, emailVerified: true });
    expect(mockSendVerificationWithProof).not.toHaveBeenCalled();
  });

  it('resends a verification email for an unverified participant', async () => {
    const { default: handler } = await import('@/pages/api/deelnemers/verificatie-opnieuw');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, emailVerified: false });
    expect(mockSignJwt).toHaveBeenCalledWith({ email: 'nieuw@test.nl' }, 'unit-test-secret', 3600);
    expect(mockSendVerificationWithProof).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'nieuw@test.nl',
        userName: 'Jan Tester',
      })
    );
  });
});
