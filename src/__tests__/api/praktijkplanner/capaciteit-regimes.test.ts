import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAccess = vi.fn();
const insertedWeeks: unknown[] = [];
const deletedTargets: unknown[] = [];

function createSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.from = vi.fn(() => builder);
  builder.where = vi.fn(() => builder);
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
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    delete: vi.fn((table: unknown) => {
      deletedTargets.push(table);
      return { where: vi.fn(async () => undefined) };
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
        delete: vi.fn((table: unknown) => {
          deletedTargets.push(table);
          return { where: vi.fn(async () => undefined) };
        }),
        insert: vi.fn(() => ({
          values: vi.fn(async (rows: unknown) => {
            insertedWeeks.push(rows);
          }),
        })),
      }),
  },
  schema: {
    capaciteitsregimes: { id: 'regimes.id', idwaarneemgroep: 'regimes.groep', naam: 'regimes.naam' },
    capaciteitsregimeweken: {
      idwaarneemgroep: 'weken.groep',
      idregime: 'weken.regime',
      maandag: 'weken.maandag',
    },
  },
}));

vi.mock('@/lib/praktijkplanner/access', () => ({
  resolvePraktijkplannerAccess: (...args: unknown[]) => mockResolveAccess(...args),
  sendPraktijkplannerAccessError: (
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    result: { error: { status: number; error: string } }
  ) => res.status(result.error.status).json({ error: result.error.error }),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((a: unknown) => a),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
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

function makeReq(method: string, body: unknown, query: Record<string, string> = {}): NextApiRequest {
  return { method, body, query, headers: {} } as unknown as NextApiRequest;
}

async function callHandler(req: NextApiRequest, res: TestResponse) {
  const { default: handler } = await import('@/pages/api/praktijkplanner/capaciteit/regimes');
  await handler(req, res);
}

describe('capaciteit regimes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectQueue.length = 0;
    insertedWeeks.length = 0;
    deletedTargets.length = 0;
    mockResolveAccess.mockResolvedValue({
      ok: true,
      access: { idwaarneemgroep: 77, isManager: true, user: { id: 3 } },
    });
  });

  it('leest met capaciteit:read en schrijft met capaciteit:manage', async () => {
    selectQueue.push([]);
    await callHandler(makeReq('GET', undefined, { idwaarneemgroep: '77' }), makeRes());
    expect(mockResolveAccess).toHaveBeenLastCalledWith(expect.anything(), '77', 'capaciteit:read');

    selectQueue.push([], [], []);
    await callHandler(makeReq('POST', { idwaarneemgroep: 77, naam: 'Zomer' }), makeRes());
    expect(mockResolveAccess).toHaveBeenLastCalledWith(expect.anything(), 77, 'capaciteit:manage');
  });

  it('geeft de weken terug bij het regime waar ze aan hangen', async () => {
    selectQueue.push(
      [{ id: 5, naam: 'Zomer' }],
      [
        { idregime: 5, maandag: '2026-07-20' },
        { idregime: 5, maandag: '2026-07-27' },
      ]
    );
    const res = makeRes();
    await callHandler(makeReq('GET', undefined, { idwaarneemgroep: '77' }), res);
    expect(res._json).toEqual({
      regimes: [{ id: 5, naam: 'Zomer', weken: ['2026-07-20', '2026-07-27'] }],
    });
  });

  it('weigert een tweede regime met dezelfde naam', async () => {
    selectQueue.push([{ id: 5 }]);
    const res = makeRes();
    await callHandler(makeReq('POST', { idwaarneemgroep: 77, naam: 'Zomer' }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Er is al een regime dat Zomer heet.' });
  });

  it('noemt het regime waar een week al bij hoort', async () => {
    selectQueue.push(
      [{ id: 5 }],
      [{ maandag: '2026-12-21', idregime: 9, naam: 'Kerst' }]
    );
    const res = makeRes();
    await callHandler(
      makeReq('PUT', { idwaarneemgroep: 77, idregime: 5, weken: ['2026-12-21'] }),
      res
    );
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'De week van 21 – 27 dec 2026 hoort al bij Kerst.' });
    expect(insertedWeeks).toHaveLength(0);
  });

  it('schuift een dag ergens in de week naar de maandag', async () => {
    selectQueue.push([{ id: 5 }], [], [{ id: 5, naam: 'Zomer' }], []);
    const res = makeRes();
    await callHandler(
      makeReq('PUT', { idwaarneemgroep: 77, idregime: 5, weken: ['2026-07-23'] }),
      res
    );
    expect(res._status).toBe(200);
    expect(insertedWeeks).toEqual([
      [expect.objectContaining({ idregime: 5, idwaarneemgroep: 77, maandag: '2026-07-20' })],
    ]);
  });

  it('weigert een regime van een andere waarneemgroep', async () => {
    selectQueue.push([]);
    const res = makeRes();
    await callHandler(makeReq('DELETE', { idwaarneemgroep: 77, idregime: 41 }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Dit regime bestaat niet.' });
    expect(deletedTargets).toHaveLength(0);
  });
});
