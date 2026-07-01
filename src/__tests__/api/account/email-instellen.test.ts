import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockGetAccountStatusForUser = vi.fn();
const mockSignOnboardingVerificationToken = vi.fn(async () => 'signed-jwt');
const mockSendVerificationEmailViaResendWithProof = vi.fn(async () => ({ resendEmailId: 're_1' }));
const mockDbUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(async () => []),
  })),
}));
const mockDbSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(async () => []),
    })),
  })),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
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
  signOnboardingVerificationToken: (...args: unknown[]) =>
    mockSignOnboardingVerificationToken(...args),
}));

vi.mock('@/lib/better-auth-url', () => ({
  resolveInviteEmailAuthApiBase: vi.fn(() => ({
    ok: true,
    authApiBase: 'http://localhost:3005/api/auth',
  })),
}));

vi.mock('@/lib/resend-email', () => ({
  sendVerificationEmailViaResendWithProof: (...args: unknown[]) =>
    mockSendVerificationEmailViaResendWithProof(...args),
}));

vi.mock('@/db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
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

type TestResponse = NextApiResponse & { _status: number; _json: unknown };

function makeReq(body: unknown): NextApiRequest {
  return {
    method: 'POST',
    headers: { origin: 'http://localhost:3005' },
    body,
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

describe('POST /api/account/email-instellen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 7, email: 'legacy', isAdmin: false });
    mockGetAccountStatusForUser.mockResolvedValue({
      emailVerified: false,
      password: null,
      login: 'legacy',
      huisemail: 'jan@example.com',
      email: 'jan@example.com',
      name: 'Jan',
      voornaam: 'Jan',
      achternaam: 'Jansen',
    });
  });

  it('rejects already verified users', async () => {
    mockGetAccountStatusForUser.mockResolvedValueOnce({
      emailVerified: true,
      login: 'jan@example.com',
    });
    const { default: handler } = await import('@/pages/api/account/email-instellen');
    const res = makeRes();
    await handler(makeReq({ email: 'jan@example.com' }), res);
    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ error: expect.stringContaining('al geverifieerd') });
  });

  it('updates login and sends verification email for unverified users', async () => {
    const { default: handler } = await import('@/pages/api/account/email-instellen');
    const res = makeRes();
    await handler(makeReq({ email: 'jan@example.com' }), res);
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, signedOut: true });
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockSendVerificationEmailViaResendWithProof).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jan@example.com' })
    );
  });

  it('rejects invalid email', async () => {
    const { isValidAccountEmail } = await import('@/lib/account-email-tokens');
    vi.mocked(isValidAccountEmail).mockReturnValueOnce(false);
    const { default: handler } = await import('@/pages/api/account/email-instellen');
    const res = makeRes();
    await handler(makeReq({ email: 'not-an-email' }), res);
    expect(res._status).toBe(400);
  });
});
