import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockCanChangeDeelnemerColor = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  canChangeDeelnemerColor: (...args: unknown[]) => mockCanChangeDeelnemerColor(...args),
}));

vi.mock('@/db', () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  schema: {
    deelnemers: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

import handler from '@/pages/api/deelnemers/color';

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  } as NextApiResponse & { statusCode: number; body: unknown };
  return res;
}

const secretarisUser = { id: 2, email: 'sec@test.nl', idgroep: 2, isAdmin: false };

describe('/api/deelnemers/color', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);
    const req = { method: 'PATCH', body: { uid: 1, color: '#ff0000' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('allows secretaris to change another participant color', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    mockCanChangeDeelnemerColor.mockResolvedValue(true);

    const req = {
      method: 'PATCH',
      body: { uid: 99, color: '#ff0000', idwaarneemgroep: 9 },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(mockCanChangeDeelnemerColor).toHaveBeenCalledWith(secretarisUser, 99, 9);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('blocks secretaris without management access', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    mockCanChangeDeelnemerColor.mockResolvedValue(false);

    const req = {
      method: 'PATCH',
      body: { uid: 99, color: '#ff0000' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Geen toegang om de kleur van een andere deelnemer te wijzigen.',
    });
  });

  it('rejects invalid color format', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(secretarisUser);
    mockCanChangeDeelnemerColor.mockResolvedValue(true);

    const req = {
      method: 'PATCH',
      body: { uid: 99, color: 'red' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid color format' });
  });
});
