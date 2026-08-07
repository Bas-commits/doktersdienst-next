import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockGetAccountStatusForUser = vi.fn();
const mockSignEmailChangeToken = vi.fn(async () => 'change-jwt');
const mockSendEmailChangeConfirmationEmailViaResend = vi.fn(async () => ({ resendEmailId: 're_2' }));
const mockVerifyEmailChangeToken = vi.fn();
const mockSignOut = vi.fn(async () => ({}));

const selectQueue: unknown[][] = [];
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(async () => selectQueue.shift() ?? []),
    })),
  })),
}));

const mockUpdateWhere = vi.fn(async () => []);
const mockUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: mockUpdateWhere,
  })),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  toHeaders: vi.fn(() => new Headers()),
}));

vi.mock('@/lib/account-status', () => ({
  getAccountStatusForUser: (...args: unknown[]) => mockGetAccountStatusForUser(...args),
  needsEmailOnboarding: (row: { emailVerified: boolean | null }) => row.emailVerified !== true,
  displayNameFromDeelnemer: vi.fn(() => 'Jan Jansen'),
}));

vi.mock('@/lib/account-email-tokens', () => ({
  getAuthSecret: vi.fn(() => 'secret'),
  isValidAccountEmail: vi.fn((email: string) => email.includes('@')),
  normalizeAccountEmail: vi.fn((email: string) => email.trim().toLowerCase()),
  signEmailChangeToken: (...args: unknown[]) => mockSignEmailChangeToken(...args),
  verifyEmailChangeToken: (...args: unknown[]) => mockVerifyEmailChangeToken(...args),
}));

vi.mock('@/lib/better-auth-url', () => ({
  getEffectivePublicSiteOriginForInvite: vi.fn(() => 'http://localhost:3005'),
}));

vi.mock('@/lib/resend-email', () => ({
  sendEmailChangeConfirmationEmailViaResend: (...args: unknown[]) =>
    mockSendEmailChangeConfirmationEmailViaResend(...args),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [] })),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  schema: {
    deelnemers: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  ne: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

type TestResponse = NextApiResponse & {
  _status: number;
  _json: unknown;
  _redirect?: string;
};

function makePostReq(body: unknown): NextApiRequest {
  return {
    method: 'POST',
    headers: { origin: 'http://localhost:3005' },
    body,
  } as unknown as NextApiRequest;
}

function makeGetReq(token: string): NextApiRequest {
  return {
    method: 'GET',
    headers: { cookie: 'session=1' },
    query: { token },
  } as unknown as NextApiRequest;
}

function makeRes(): TestResponse {
  const res = {
    _status: 200,
    _json: null as unknown,
    _redirect: undefined as string | undefined,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(payload: unknown) {
      res._json = payload;
      return res;
    },
    redirect(statusCode: number, url: string) {
      res._status = statusCode;
      res._redirect = url;
      return res;
    },
    setHeader: vi.fn(),
  };
  return res as unknown as TestResponse;
}

describe('account email change flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    mockGetAuthenticatedUser.mockResolvedValue({ id: 7, email: 'old@example.com', isAdmin: true });
    mockGetAccountStatusForUser.mockResolvedValue({
      emailVerified: true,
      password: 'ba-upgraded:v1',
      login: 'old@example.com',
      huisemail: 'old@example.com',
      email: 'old@example.com',
      name: 'Jan',
      voornaam: 'Jan',
      achternaam: 'Jansen',
    });
  });

  it('POST email-wijziging-aanvragen sends confirmation email', async () => {
    const { default: handler } = await import('@/pages/api/account/email-wijziging-aanvragen');
    const res = makeRes();
    await handler(makePostReq({ newEmail: 'new@example.com' }), res);
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true });
    expect(mockSendEmailChangeConfirmationEmailViaResend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@example.com' })
    );
  });

  it('POST weigert iedereen die geen beheerder is', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({
      id: 7,
      email: 'old@example.com',
      isAdmin: false,
    });
    const { default: handler } = await import('@/pages/api/account/email-wijziging-aanvragen');
    const res = makeRes();
    await handler(makePostReq({ newEmail: 'new@example.com' }), res);
    expect(res._status).toBe(403);
    expect(mockSendEmailChangeConfirmationEmailViaResend).not.toHaveBeenCalled();
  });

  it('POST rejects unverified users', async () => {
    mockGetAccountStatusForUser.mockResolvedValueOnce({
      emailVerified: false,
      login: 'legacy',
    });
    const { default: handler } = await import('@/pages/api/account/email-wijziging-aanvragen');
    const res = makeRes();
    await handler(makePostReq({ newEmail: 'new@example.com' }), res);
    expect(res._status).toBe(400);
  });

  it('GET bevestig-email-wijziging updates login and signs out', async () => {
    mockVerifyEmailChangeToken.mockResolvedValueOnce({
      userId: 7,
      newEmail: 'new@example.com',
    });
    selectQueue.push(
      [{ id: 7, login: 'old@example.com', emailVerified: true }],
      []
    );

    const { default: handler } = await import('@/pages/api/account/bevestig-email-wijziging');
    const res = makeRes();
    await handler(makeGetReq('change-jwt'), res);

    expect(res._status).toBe(302);
    expect(res._redirect).toBe('/login?emailChanged=ok');
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
