import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST,
  BEHEERDER_WIJZIGT_ANDERMANS_WACHTWOORD_TEKST,
} from '@/lib/beheerder-contact';

const STERK_WACHTWOORD = 'Zeergeheim!2026';

const mockGetAuthenticatedUser = vi.fn();
const mockHasDelegatedProfileAccess = vi.fn();
const mockCanEditEchtedeelnemer = vi.fn();
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
  canEditEchtedeelnemer: (...args: unknown[]) => mockCanEditEchtedeelnemer(...args),
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
    expertises: {},
    deelnemerexpertises: {},
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

const mockVerifyStoredCredentialHash = vi.fn(async () => true);

vi.mock('@/lib/legacy-credential', () => ({
  resolveStoredCredentialHash: vi.fn((row: { encrypted_password: string | null }) =>
    row.encrypted_password
  ),
  verifyStoredCredentialHash: (...args: unknown[]) => mockVerifyStoredCredentialHash(...args),
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
    mockCanEditEchtedeelnemer.mockResolvedValue(true);
    mockVerifyStoredCredentialHash.mockResolvedValue(true);
    mockPoolQuery.mockResolvedValue({ rows: [] });
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

  it('rejects delegated PATCH attempts to change email', async () => {
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
    expect(res._json).toEqual({ error: BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST });
  });

  it('rejects a secretaris setting the password of another participant', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { passa: STERK_WACHTWOORD, passb: STERK_WACHTWOORD },
      }),
      res
    );

    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: BEHEERDER_WIJZIGT_ANDERMANS_WACHTWOORD_TEKST });
  });

  it('lets an administrator set another password without knowing the current one', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({
      id: 1,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { passa: STERK_WACHTWOORD, passb: STERK_WACHTWOORD },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(mockVerifyStoredCredentialHash).not.toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedPassword: `hashed-${STERK_WACHTWOORD}` })
    );
  });

  it('accepts a delegated PATCH that echoes the unchanged email back', async () => {
    selectQueue.push(
      [{ login: 'old@example.com', huisemail: 'old@example.com', emailVerified: true }],
      []
    );

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { huisemail: 'old@example.com' },
      }),
      res
    );

    expect(res._status).toBe(200);
  });

  it('sends an administrator changing another email through the confirmation flow too', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({
      id: 1,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    selectQueue.push(
      [{ login: 'old@example.com', huisemail: 'old@example.com', emailVerified: true }],
      []
    );

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        query: { deelnemerId: '22' },
        body: { huisemail: 'new@example.com' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('sends a participant changing their own email through the confirmation flow', async () => {
    selectQueue.push([
      { login: 'old@example.com', huisemail: 'old@example.com', emailVerified: true },
    ]);

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { huisemail: 'new@example.com' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('sends a verified administrator changing their own email through the confirmation flow', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({
      id: 10,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    selectQueue.push([
      { login: 'old@example.com', huisemail: 'old@example.com', emailVerified: true },
    ]);

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { huisemail: 'new@example.com' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({
      code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION',
    });
  });

  it('lets a participant change their own password with the current one', async () => {
    selectQueue.push([{ encryptedPassword: 'OUDEHASH', password: null }]);

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { passa: STERK_WACHTWOORD, passb: STERK_WACHTWOORD, huidigWachtwoord: 'oud' },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(mockVerifyStoredCredentialHash).toHaveBeenCalledWith('OUDEHASH', 'oud');
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedPassword: `hashed-${STERK_WACHTWOORD}` })
    );
  });

  it('refuses an own password change without the current password', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { passa: STERK_WACHTWOORD, passb: STERK_WACHTWOORD },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Vul uw huidige wachtwoord in' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('refuses an own password change when the current password is wrong', async () => {
    mockVerifyStoredCredentialHash.mockResolvedValueOnce(false);
    selectQueue.push([{ encryptedPassword: 'OUDEHASH', password: null }]);

    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { passa: STERK_WACHTWOORD, passb: STERK_WACHTWOORD, huidigWachtwoord: 'fout' },
      }),
      res
    );

    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Uw huidige wachtwoord klopt niet' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('refuses a new password that does not meet the rules', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { passa: 'geheim', passb: 'geheim', huidigWachtwoord: 'oud' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(String((res._json as { error: string }).error)).toContain('sterker wachtwoord');
    expect(mockVerifyStoredCredentialHash).not.toHaveBeenCalled();
  });

  it('rejects invalid phone fields on PATCH', async () => {
    const { default: handler } = await import('@/pages/api/mijn-gegevens/index');
    const res = makeRes();

    await handler(
      makeReq('PATCH', {
        body: { huisadrtelnr: 'abc' },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toEqual({
      error: 'Telefoonnummer is ongeldig. Gebruik bijvoorbeeld 0612345678, 31612345678 of +31612345678.',
    });
  });
});
