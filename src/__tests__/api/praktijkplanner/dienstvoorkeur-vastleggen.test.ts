import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAccess = vi.fn();
const ingevoegdeRijen: unknown[] = [];
let staandeVoorkeur: { isVoorlopig: boolean } | null = null;

function createSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.from = vi.fn(() => builder);
  builder.where = vi.fn(() => builder);
  builder.orderBy = vi.fn(() => builder);
  builder.limit = vi.fn(async () => rows);
  builder.then = (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return builder;
}

function createTx() {
  return {
    select: vi.fn(() => createSelectBuilder(staandeVoorkeur ? [staandeVoorkeur] : [])),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    insert: vi.fn(() => ({
      values: vi.fn(async (row: unknown) => {
        ingevoegdeRijen.push(row);
      }),
    })),
  };
}

vi.mock('@/db', () => ({
  db: {
    // De enige select buiten de transactie controleert of het dagdeel bestaat.
    select: vi.fn(() => createSelectBuilder([{ id: 1 }])),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(createTx()),
  },
  schema: {
    praktijkplannerdienstvoorkeuren: {},
    dagdelen: {},
  },
}));

vi.mock('@/lib/praktijkplanner/access', () => ({
  resolvePraktijkplannerAccess: (...args: unknown[]) => mockResolveAccess(...args),
  sendPraktijkplannerAccessError: (
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    result: { error: { status: number; error: string } }
  ) => res.status(result.error.status).json({ error: result.error.error }),
  canAccessPraktijkplannerParticipant: vi.fn(async () => true),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((a: unknown) => a),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  gte: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
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

function morgen(): string {
  const dag = new Date();
  dag.setDate(dag.getDate() + 1);
  return dag.toISOString().slice(0, 10);
}

async function post(body: unknown, res: TestResponse) {
  const { default: handler } = await import('@/pages/api/praktijkplanner/dienstvoorkeuren/index');
  await handler({ method: 'POST', body, query: {}, headers: {} } as unknown as NextApiRequest, res);
}

function geefToegang(isManager: boolean) {
  mockResolveAccess.mockResolvedValue({
    ok: true,
    access: { idwaarneemgroep: 77, isManager, user: { id: 119 } },
  });
}

function mutatie(extra: Record<string, unknown> = {}) {
  return {
    idwaarneemgroep: 77,
    voorkeuren: [
      { iddeelnemer: 119, datum: morgen(), iddagdeel: 1, voorkeur: 'graag', ...extra },
    ],
  };
}

describe('een dienstvoorkeur vastleggen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ingevoegdeRijen.length = 0;
    staandeVoorkeur = null;
  });

  it('bewaart wat de planner vastlegt', async () => {
    geefToegang(true);
    const res = makeRes();
    await post(mutatie({ isVoorlopig: false }), res);

    expect(res._status).toBe(200);
    expect(ingevoegdeRijen[0]).toMatchObject({ voorkeur: 'graag', isVoorlopig: false });
  });

  it('houdt een aanvraag een aanvraag als de toestand ontbreekt', async () => {
    geefToegang(true);
    const res = makeRes();
    await post(mutatie(), res);

    expect(res._status).toBe(200);
    expect(ingevoegdeRijen[0]).toMatchObject({ isVoorlopig: true });
  });

  it('laat een arts niets vastleggen', async () => {
    geefToegang(false);
    const res = makeRes();
    await post(mutatie({ isVoorlopig: false }), res);

    expect(res._status).toBe(403);
    expect(ingevoegdeRijen).toHaveLength(0);
  });

  it('laat een arts niet aan wat de planner heeft vastgelegd', async () => {
    geefToegang(false);
    staandeVoorkeur = { isVoorlopig: false };
    const res = makeRes();
    await post(mutatie({ isVoorlopig: true }), res);

    expect(res._status).toBe(403);
    expect(ingevoegdeRijen).toHaveLength(0);
  });
});
