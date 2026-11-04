import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAccess = vi.fn();
const transactionRan = vi.fn();

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
const opgeslagenRijen: unknown[] = [];

function createTx() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn((rows: unknown) => {
        opgeslagenRijen.push(rows);
        return {
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(async () =>
              (rows as Array<Record<string, unknown>>).map((row, index) => ({
                id: index + 1,
                weekdag: row.weekdag,
                iddagdeel: row.iddagdeel,
              }))
            ),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  };
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionRan();
      return fn(createTx());
    },
  },
  schema: {
    capaciteitsjablonen: {},
    capaciteitsregimes: {},
    praktijkplannerlocaties: {},
    dagdelen: {},
    taaktypen: {},
    expertises: {},
    activiteiten: {},
    activiteitSpecificaties: {},
    capaciteitsjabloonexpertises: {},
    capaciteitsjabloontaken: {},
    capaciteitsjabloonactiviteiten: {},
    capaciteitsjabloonspecificaties: {},
  },
}));

vi.mock('@/lib/praktijkplanner/access', () => ({
  resolvePraktijkplannerAccess: (...args: unknown[]) => mockResolveAccess(...args),
  sendPraktijkplannerAccessError: (
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    result: { error: { status: number; error: string } }
  ) => res.status(result.error.status).json({ error: result.error.error }),
}));

vi.mock('@/lib/praktijkplanner/schedulable-dayparts-db', () => ({
  loadSchedulableDayparts: vi.fn(async () => []),
}));

// Elk dagdeel in deze test staat uit bij de groep; daar mag alleen een dienst op.
vi.mock('@/lib/praktijkplanner/schedulable-dayparts', () => ({
  isDaypartSchedulable: vi.fn(() => false),
}));

vi.mock('@/lib/praktijkplanner/dienst-taaktypen', () => ({
  dienstTaaktypeIds: vi.fn(async () => new Set([50])),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
  isNull: vi.fn((a: unknown) => a),
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

function cel(tasks: Array<{ id: number; aantal: number }>) {
  return {
    weekdag: 1,
    iddagdeel: 1,
    aantalDeelnemers: 0,
    expertises: [],
    tasks,
    activities: [],
    specifications: [],
  };
}

async function post(body: unknown, res: TestResponse) {
  const { default: handler } = await import('@/pages/api/praktijkplanner/capaciteit/index');
  await handler({ method: 'POST', body, query: {}, headers: {} } as unknown as NextApiRequest, res);
}

// Taak 50 is een dienst, taak 46 is een gewone locatiegebonden taak.
const DIENST = 50;
const GEWOON = 46;

describe('capaciteit op een dagdeel dat de groep heeft uitgezet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectQueue.length = 0;
    opgeslagenRijen.length = 0;
    mockResolveAccess.mockResolvedValue({
      ok: true,
      access: { idwaarneemgroep: 77, isManager: true, user: { id: 3 } },
    });
  });

  it('weigert een gewone taak', async () => {
    selectQueue.push([{ id: 3 }], [{ id: 1 }], [{ id: GEWOON }], []);
    const res = makeRes();
    await post(
      { idwaarneemgroep: 77, idplannerlocatie: 3, cells: [cel([{ id: GEWOON, aantal: 1 }])] },
      res
    );

    expect(res._status).toBe(400);
    expect(res._json).toEqual({
      error: 'Dit dagdeel is niet inplanbaar voor deze weekdag; alleen een dienst mag hier.',
    });
    expect(transactionRan).not.toHaveBeenCalled();
  });

  it('weigert een aantal dokters', async () => {
    selectQueue.push([{ id: 3 }], [{ id: 1 }], [], []);
    const res = makeRes();
    await post(
      {
        idwaarneemgroep: 77,
        idplannerlocatie: 3,
        cells: [{ ...cel([]), aantalDeelnemers: 2 }],
      },
      res
    );

    expect(res._status).toBe(400);
    expect(transactionRan).not.toHaveBeenCalled();
  });

  it('bewaart een eis voor een dienst', async () => {
    selectQueue.push([{ id: 3 }], [{ id: 1 }], [{ id: DIENST }], []);
    const res = makeRes();
    await post(
      { idwaarneemgroep: 77, idplannerlocatie: 3, cells: [cel([{ id: DIENST, aantal: 1 }])] },
      res
    );

    expect(res._status).toBe(200);
    expect(transactionRan).toHaveBeenCalled();
    // De cel wordt echt weggeschreven en niet stilletjes overgeslagen, zoals eerst.
    expect(opgeslagenRijen.length).toBeGreaterThan(0);
  });
});
