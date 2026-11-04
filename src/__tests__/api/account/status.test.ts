import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAuthenticatedUser = vi.fn();
const mockGetAccountStatusForUser = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

vi.mock('@/lib/account-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/account-status')>();
  return {
    ...actual,
    getAccountStatusForUser: (...args: unknown[]) => mockGetAccountStatusForUser(...args),
    displayNameFromDeelnemer: vi.fn(() => 'Jan Jansen'),
  };
});

type TestResponse = NextApiResponse & { _status: number; _json: unknown };

function makeReq(): NextApiRequest {
  return {
    method: 'GET',
    headers: { cookie: 's=1' },
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

describe('GET /api/account/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 7, email: 'jan@example.com', isAdmin: false });
  });

  it('returns onboarding flag for unverified users', async () => {
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
    const { default: handler } = await import('@/pages/api/account/status');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ needsEmailOnboarding: true, login: 'legacy' });
  });

  it('does not require password setup for verified users with legacy password', async () => {
    mockGetAccountStatusForUser.mockResolvedValue({
      emailVerified: true,
      password: '$2y$10$legacybcrypt',
      login: 'jan@example.com',
      huisemail: 'jan@example.com',
      email: 'jan@example.com',
      name: 'Jan',
      voornaam: 'Jan',
      achternaam: 'Jansen',
    });
    const { default: handler } = await import('@/pages/api/account/status');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._json).toMatchObject({ needsEmailOnboarding: false });
  });

  it('returns false onboarding for verified users with upgraded password', async () => {
    mockGetAccountStatusForUser.mockResolvedValue({
      emailVerified: true,
      password: 'ba-upgraded:v1',
      login: 'jan@example.com',
      huisemail: 'jan@example.com',
      email: 'jan@example.com',
      name: 'Jan',
      voornaam: 'Jan',
      achternaam: 'Jansen',
    });
    const { default: handler } = await import('@/pages/api/account/status');
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._json).toMatchObject({ needsEmailOnboarding: false });
  });
});
