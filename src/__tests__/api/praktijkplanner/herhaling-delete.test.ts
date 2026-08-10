import type { NextApiRequest, NextApiResponse } from 'next';
import { inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAccess = vi.fn();
const deletedTargets: unknown[] = [];

function createSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.from = vi.fn(() => builder);
  builder.where = vi.fn(() => builder);
  builder.leftJoin = vi.fn(() => builder);
  builder.innerJoin = vi.fn(() => builder);
  builder.orderBy = vi.fn(() => builder);
  builder.limit = vi.fn(async () => rows);
  builder.then = (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return builder;
}

const selectQueue: unknown[][] = [];

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
    delete: vi.fn((table: unknown) => {
      deletedTargets.push(table);
      return { where: vi.fn(async () => undefined) };
    }),
    insert: vi.fn(),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        delete: vi.fn((table: unknown) => {
          deletedTargets.push(table);
          return { where: vi.fn(async () => undefined) };
        }),
        select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn(async () => []) })),
        })),
      }),
  },
  schema: {
    planningherhalingen: { id: 'series' },
    planningherhalingslots: {
      idherhaling: 'link.herhaling',
      idplanning: 'link.planning',
      reeksdatum: 'link.reeksdatum',
      isBronslot: 'link.bron',
      isUitzondering: 'link.uitzondering',
    },
    planningherhalinguitzonderingen: {
      idherhaling: 'tomb.herhaling',
      reeksdatum: 'tomb.reeksdatum',
      iddagdeel: 'tomb.dagdeel',
    },
    planning: { id: 'planning' },
    planningtaak: {},
    planningbeschikbaarheid: {},
  },
}));

vi.mock('@/lib/praktijkplanner/access', () => ({
  resolvePraktijkplannerAccess: (...args: unknown[]) => mockResolveAccess(...args),
  canAccessPraktijkplannerParticipant: vi.fn(async () => true),
  sendPraktijkplannerAccessError: (
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    result: { status: number; error: string }
  ) => res.status(result.status).json({ error: result.error }),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  gte: vi.fn((a: unknown, b: unknown) => [a, b]),
  lte: vi.fn((a: unknown, b: unknown) => [a, b]),
  asc: vi.fn((a: unknown) => a),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn() }),
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

describe('POST herhaling delete modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedTargets.length = 0;
    selectQueue.length = 0;
    mockResolveAccess.mockResolvedValue({
      ok: true,
      access: { idwaarneemgroep: 77, isManager: true, user: { id: 1 } },
    });
    vi.resetModules();
  });

  it('unlinks series without deleting planning rows', async () => {
    selectQueue.push([
      {
        id: 9,
        iddeelnemer: 7,
        startdatum: '2026-07-20',
        einddatum: '2026-08-10',
        frequentieWeken: 1,
      },
    ]);
    selectQueue.push([{ idplanning: 100, reeksdatum: '2026-07-20' }]);

    const { default: handler } = await import('@/pages/api/praktijkplanner/activiteiten/herhaling');
    const res = makeRes();
    await handler(
      {
        method: 'POST',
        headers: { cookie: 's=1' },
        body: {
          action: 'delete',
          mode: 'unlink',
          idwaarneemgroep: 77,
          idherhaling: 9,
        },
      } as unknown as NextApiRequest,
      res
    );

    expect(res._status).toBe(200);
    expect(deletedTargets).toContainEqual({ id: 'series' });
    expect(deletedTargets).not.toContainEqual({ id: 'planning' });
  });

  it('deletePlanning spares the planning of the source week', async () => {
    selectQueue.push([
      {
        id: 9,
        iddeelnemer: 7,
        startdatum: '2026-07-20',
        einddatum: '2026-08-10',
        frequentieWeken: 1,
        bronstartdatum: '2026-07-13',
      },
    ]);
    selectQueue.push([
      { idplanning: 50, reeksdatum: '2026-07-15' },
      { idplanning: 100, reeksdatum: '2026-07-20' },
    ]);

    const { default: handler } = await import('@/pages/api/praktijkplanner/activiteiten/herhaling');
    const res = makeRes();
    await handler(
      {
        method: 'POST',
        headers: { cookie: 's=1' },
        body: {
          action: 'delete',
          mode: 'deletePlanning',
          idwaarneemgroep: 77,
          idherhaling: 9,
        },
      } as unknown as NextApiRequest,
      res
    );

    expect(res._status).toBe(200);
    const planningDeletes = vi
      .mocked(inArray)
      .mock.calls.filter(([column]) => column === 'planning');
    expect(planningDeletes).toHaveLength(1);
    expect(planningDeletes[0][1]).toEqual([100]);
    expect(deletedTargets).toContainEqual({ id: 'series' });
  });

  it('deletePlanning removes linked planning rows', async () => {
    selectQueue.push([
      {
        id: 9,
        iddeelnemer: 7,
        startdatum: '2026-07-20',
        einddatum: '2026-08-10',
        frequentieWeken: 1,
      },
    ]);
    selectQueue.push([{ idplanning: 100, reeksdatum: '2026-07-20' }]);
    selectQueue.push([]); // remaining links after delete

    const { default: handler } = await import('@/pages/api/praktijkplanner/activiteiten/herhaling');
    const res = makeRes();
    await handler(
      {
        method: 'POST',
        headers: { cookie: 's=1' },
        body: {
          action: 'delete',
          mode: 'deletePlanning',
          idwaarneemgroep: 77,
          idherhaling: 9,
        },
      } as unknown as NextApiRequest,
      res
    );

    expect(res._status).toBe(200);
    expect(deletedTargets).toContainEqual({ id: 'planning' });
  });
});
