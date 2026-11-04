import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAccess = vi.fn();
const mockCanAccessParticipant = vi.fn();
const mockSendNotify = vi.fn();
const mockSendSchedule = vi.fn();
const mockInsertValues = vi.fn(async () => undefined);

const selectQueue: unknown[][] = [];
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(async () => selectQueue.shift() ?? []),
    })),
  })),
}));

vi.mock('@/lib/praktijkplanner/access', () => ({
  resolvePraktijkplannerAccess: (...args: unknown[]) => mockResolveAccess(...args),
  canAccessPraktijkplannerParticipant: (...args: unknown[]) => mockCanAccessParticipant(...args),
  sendPraktijkplannerAccessError: (
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    result: { status: number; error: string }
  ) => res.status(result.status).json({ error: result.error }),
}));

vi.mock('@/lib/resend-email', () => ({
  sendPraktijkplannerPlanningAvailableEmailViaResend: (...args: unknown[]) =>
    mockSendNotify(...args),
  sendPraktijkplannerScheduleEmailViaResend: (...args: unknown[]) => mockSendSchedule(...args),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: vi.fn(() => ({
      values: (...args: unknown[]) => mockInsertValues(...args),
    })),
  },
  schema: {
    deelnemers: {
      id: 'deelnemers.id',
      login: 'deelnemers.login',
      huisemail: 'deelnemers.huisemail',
      email: 'deelnemers.email',
      voornaam: 'deelnemers.voornaam',
      achternaam: 'deelnemers.achternaam',
      name: 'deelnemers.name',
    },
    praktijkplanneremaillog: {},
    planning: {},
    dagdelen: {},
    activiteiten: {},
    activiteitSpecificaties: {},
    praktijkplannerlocaties: {},
    planningafwezigheden: {},
    afwezigheidstypen: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((a: unknown) => a),
  gte: vi.fn((a: unknown, b: unknown) => [a, b]),
  lte: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

type TestResponse = NextApiResponse & { _status: number; _json: unknown };

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

function makeReq(body: Record<string, unknown>): NextApiRequest {
  return {
    method: 'POST',
    headers: { cookie: 's=1' },
    body,
  } as unknown as NextApiRequest;
}

describe('POST /api/praktijkplanner/email notify mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    mockResolveAccess.mockResolvedValue({
      ok: true,
      access: {
        idwaarneemgroep: 3,
        isManager: true,
        user: { id: 1 },
      },
    });
    mockCanAccessParticipant.mockResolvedValue(true);
    mockSendNotify.mockResolvedValue({ resendEmailId: 're_123' });
  });

  it('sends notify mail to deelnemers.login', async () => {
    selectQueue.push([
      {
        login: 'arts@example.nl',
        voornaam: 'Ada',
        achternaam: 'Lovelace',
        name: null,
      },
    ]);
    const { default: handler } = await import('@/pages/api/praktijkplanner/email');
    const res = makeRes();
    await handler(
      makeReq({
        mode: 'notify',
        plannerType: 'activiteiten',
        idwaarneemgroep: 3,
        iddeelnemer: 7,
      }),
      res
    );
    expect(res._status).toBe(200);
    expect(mockSendNotify).toHaveBeenCalledWith({
      to: 'arts@example.nl',
      userName: 'Ada Lovelace',
    });
    expect(mockSendSchedule).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ontvanger: 'arts@example.nl',
        type: 'activiteiten-notify',
        onderwerp: 'Nieuwe planning beschikbaar in Praktijkplanner',
      })
    );
  });

  it('returns 400 when login is missing', async () => {
    selectQueue.push([
      {
        login: null,
        voornaam: 'Ada',
        achternaam: 'Lovelace',
        name: null,
      },
    ]);
    const { default: handler } = await import('@/pages/api/praktijkplanner/email');
    const res = makeRes();
    await handler(
      makeReq({
        mode: 'notify',
        plannerType: 'activiteiten',
        idwaarneemgroep: 3,
        iddeelnemer: 7,
      }),
      res
    );
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Deze deelnemer heeft geen login-e-mailadres.' });
    expect(mockSendNotify).not.toHaveBeenCalled();
  });
});
