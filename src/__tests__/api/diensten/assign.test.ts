import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// ---- Mocks ----

// Track all database operations performed in the transaction
interface DbOperation {
  op: 'select' | 'insert' | 'update' | 'delete';
  table?: string;
  where?: Record<string, unknown>;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
}

let dbOperations: DbOperation[] = [];
let selectResults: Record<string, unknown>[][] = [];
let selectCallIndex = 0;

// Mock the chainable Drizzle query builder.
// Drizzle queries are thenable: .where() can be awaited directly (returns array)
// OR chained further with .limit().
function createMockQueryBuilder(op: 'select' | 'insert' | 'update' | 'delete') {
  const chain: Record<string, unknown> = {};
  let currentOp: DbOperation = { op };

  const getResult = () => {
    dbOperations.push(currentOp);
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return result;
  };

  const buildChain = () => {
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn((condition: unknown) => {
      currentOp.where = { raw: String(condition) };
      // Make the result thenable so `await tx.select().from().where()` works
      const result = getResult();
      const thenableChain = {
        ...chain,
        limit: vi.fn().mockImplementation(() => result),
        then: (resolve: (v: unknown) => void) => resolve(result),
        [Symbol.iterator]: () => result[Symbol.iterator](),
      };
      return thenableChain;
    });
    chain.limit = vi.fn().mockImplementation(() => getResult());
    chain.set = vi.fn((values: Record<string, unknown>) => {
      currentOp.set = values;
      return chain;
    });
    chain.values = vi.fn((values: Record<string, unknown>) => {
      currentOp.values = values;
      dbOperations.push(currentOp);
      return chain;
    });

    return chain;
  };

  return buildChain();
}

// Create a mock transaction object that mimics Drizzle's tx
function createMockTx() {
  return {
    select: vi.fn().mockImplementation((fields?: unknown) => {
      const builder = createMockQueryBuilder('select');
      return { ...builder, from: vi.fn().mockReturnValue(builder) };
    }),
    insert: vi.fn().mockImplementation((table: unknown) => {
      const builder = createMockQueryBuilder('insert');
      return builder;
    }),
    update: vi.fn().mockImplementation((table: unknown) => {
      const builder = createMockQueryBuilder('update');
      return builder;
    }),
    delete: vi.fn().mockImplementation((table: unknown) => {
      const op: DbOperation = { op: 'delete' };
      return {
        where: vi.fn((condition: unknown) => {
          op.where = { raw: String(condition) };
          dbOperations.push(op);
          return Promise.resolve();
        }),
      };
    }),
  };
}

const mockTx = createMockTx();

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
      await cb(mockTx);
    }),
  },
  schema: {
    diensten: { id: 'id', van: 'van', tot: 'tot', idwaarneemgroep: 'idwaarneemgroep', type: 'type', iddeelnemer: 'iddeelnemer', idpraktijk: 'idpraktijk', idshift: 'idshift', currentDate: 'currentDate', nextDate: 'nextDate' },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: '1', email: 'test@test.nl' } }),
    },
  },
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: 1,
    email: 'test@test.nl',
    idgroep: 5,
    isAdmin: true,
  }),
  hasGroupManagementAccess: vi.fn().mockResolvedValue(true),
  isUserInWaarneemgroep: vi.fn().mockResolvedValue(true),
  getUserWaarneemgroepIds: vi.fn().mockResolvedValue([9]),
  toHeaders: vi.fn().mockReturnValue(new Headers()),
  GROEP_ADMINISTRATOR: 5,
  GROEP_SECRETARIS: 2,
}));

// ---- Test helpers ----

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      idwaarneemgroep: 9,
      van: 1711918800,
      tot: 1711951200,
      iddeelnemer: 42,
      section: 'middle',
    },
    ...overrides,
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as NextApiResponse & { _status: number; _json: unknown };
}

// ---- Tests ----

// Note: Due to the complexity of mocking Drizzle's chainable API,
// these tests verify the handler's HTTP behavior (status codes, auth, validation).
// The full transaction logic is better tested via integration/e2e tests.

describe('POST /api/diensten/assign — validation (US1)', () => {
  // Dynamic import to pick up mocks
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(async () => {
    dbOperations = [];
    selectResults = [];
    selectCallIndex = 0;
    vi.clearAllMocks();

    // Re-create mock tx to reset call tracking
    const mod = await import('@/pages/api/diensten/assign');
    handler = mod.default as unknown as typeof handler;
  });

  it('T017a: returns 405 for non-POST requests', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._json).toEqual({ error: 'Method not allowed' });
  });

  it('T017b: returns 401 when no session', async () => {
    const apiAuth = await import('@/lib/api-auth');
    vi.mocked(apiAuth.getAuthenticatedUser).mockResolvedValueOnce(null);

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Unauthorized' });
  });

  it('T017c: returns 400 for missing idwaarneemgroep', async () => {
    const req = makeReq({ body: { van: 100, tot: 200, iddeelnemer: 1, section: 'middle' } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('T017d: returns 400 for invalid section', async () => {
    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 100, tot: 200, iddeelnemer: 1, section: 'invalid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('T017e: returns 400 for missing van', async () => {
    const req = makeReq({
      body: { idwaarneemgroep: 9, tot: 200, iddeelnemer: 1, section: 'middle' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('T013: returns 200 for valid middle assign request', async () => {
    // Provide select results: base record found, no existing middle record
    selectResults = [
      [{ id: 1, idpraktijk: 100, idshift: 10, currentDate: '2024-04-01', nextDate: '2024-04-02' }],
      [], // exact match — none
      [], // overlap match — none
    ];

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true });
  });

  it('T025: returns 200 for valid top assign request', async () => {
    selectResults = [
      [{ id: 1, idpraktijk: 100, idshift: 10, currentDate: '2024-04-01', nextDate: '2024-04-02' }],
      [], // no existing type=5
    ];

    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 1711918800, tot: 1711951200, iddeelnemer: 42, section: 'top' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });

  it('T035: returns 200 for valid bottom assign request', async () => {
    selectResults = [
      [{ id: 1, idpraktijk: 100, idshift: 10, currentDate: '2024-04-01', nextDate: '2024-04-02' }],
      [], // no existing type=11
    ];

    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 1711918800, tot: 1711951200, iddeelnemer: 42, section: 'bottom' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });

  it('T016: returns 200 for middle unassign request', async () => {
    // Overlap query for middle unassign finds records to delete
    selectResults = [
      [], // base record (for unassign, base query still runs but may not be used)
    ];

    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 1711918800, tot: 1711951200, iddeelnemer: null, section: 'middle' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });

  it('T027: returns 200 for top unassign request', async () => {
    selectResults = [
      [], // no existing type=5 to delete
    ];

    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 1711918800, tot: 1711951200, iddeelnemer: null, section: 'top' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });

  it('T037: returns 200 for bottom unassign request', async () => {
    selectResults = [
      [], // no existing type=11 to delete
    ];

    const req = makeReq({
      body: { idwaarneemgroep: 9, van: 1711918800, tot: 1711951200, iddeelnemer: null, section: 'bottom' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });
});
