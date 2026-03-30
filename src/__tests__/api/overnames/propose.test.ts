import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// ---- Mocks ----

let selectResults: Record<string, unknown>[][] = [];
let selectCallIndex = 0;
let lastInsertValues: Record<string, unknown> | null = null;
let insertReturning: Record<string, unknown>[] = [];

/**
 * Mock Drizzle chainable query builder.
 *
 * The propose handler uses direct `db.select().from().where().limit()` and
 * `db.insert().values().returning()` calls (no transaction).
 *
 * DB call order for a type=1 → type=0 resolution flow:
 *   0  select deelnemers (proposingDoctor)
 *   1  select diensten   (originalDienst by id)
 *   2  select diensten   (type=0 overlap candidates)
 *   3  select waarneemgroepdeelnemers (targetInGroup)
 *   4  select diensten   (existingProposal)
 *   5  insert diensten   (create proposal) → returning
 */
function createMockChain() {
  const chain: Record<string, unknown> = {};

  const getResult = () => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return result;
  };

  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn(() => {
    const result = getResult();
    return {
      ...chain,
      limit: vi.fn().mockImplementation(() => result),
      then: (resolve: (v: unknown) => void) => resolve(result),
      [Symbol.iterator]: () => result[Symbol.iterator](),
    };
  });
  chain.limit = vi.fn().mockImplementation(() => getResult());
  chain.values = vi.fn((vals: Record<string, unknown>) => {
    lastInsertValues = vals;
    return {
      returning: vi.fn().mockImplementation(() => insertReturning),
    };
  });
  chain.returning = vi.fn().mockImplementation(() => insertReturning);

  return chain;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain = createMockChain();
      return { ...chain, from: vi.fn().mockReturnValue(chain) };
    }),
    insert: vi.fn(() => createMockChain()),
  },
  schema: {
    diensten: {
      id: 'id', type: 'type', van: 'van', tot: 'tot',
      iddeelnemer: 'iddeelnemer', idwaarneemgroep: 'idwaarneemgroep',
      status: 'status', iddienstovern: 'iddienstovern',
      iddeelnovern: 'iddeelnovern', senderId: 'senderId',
      idpraktijk: 'idpraktijk', rol: 'rol', iddienstherhalen: 'iddienstherhalen',
      idaantekening: 'idaantekening', idshift: 'idshift', idtarief: 'idtarief',
      idkamer: 'idkamer', idtelnr: 'idtelnr', idlocatie: 'idlocatie',
      iddeelnemer2: 'iddeelnemer2', idtaaktype: 'idtaaktype',
      deleteRequest: 'deleteRequest',
    },
    deelnemers: { id: 'id', login: 'login' },
    waarneemgroepdeelnemers: { idwaarneemgroep: 'idwaarneemgroep', iddeelnemer: 'iddeelnemer' },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: '1', email: 'test@test.nl' } }),
    },
  },
}));

// ---- Helpers ----

const VAN = 1711918800;  // 2024-04-01 07:00 UTC
const TOT = 1711951200;  // 2024-04-01 16:00 UTC
const WG = 9;
const SENDER_ID = 10;
const TARGET_ID = 42;

function makeReq(bodyOverrides: Record<string, unknown> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      iddienstovern: 500,
      iddeelnovern: TARGET_ID,
      van: VAN,
      tot: TOT,
      idwaarneemgroep: WG,
      ...bodyOverrides,
    },
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) { res._status = code; return res; },
    json(data: unknown) { res._json = data; return res; },
  };
  return res as unknown as NextApiResponse & { _status: number; _json: unknown };
}

// ---- Tests ----

describe('POST /api/overnames/propose', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(async () => {
    selectResults = [];
    selectCallIndex = 0;
    lastInsertValues = null;
    insertReturning = [];
    vi.clearAllMocks();
    handler = (await import('@/pages/api/overnames/propose')).default;
  });

  // -- Validation --

  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} } as unknown as NextApiRequest, res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when no session', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never);
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = makeRes();
    await handler(makeReq({ iddeelnovern: undefined }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Missing required fields' });
  });

  it('returns 400 when van >= tot', async () => {
    const res = makeRes();
    await handler(makeReq({ van: TOT, tot: VAN }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Invalid time range' });
  });

  // -- Direct type=0 flow --

  it('creates proposal when original dienst is type=0 directly', async () => {
    selectResults = [
      [{ id: SENDER_ID }],                                           // 0: proposingDoctor
      [{ id: 500, type: 0, van: VAN, tot: TOT, iddeelnemer: 99, idwaarneemgroep: WG }],  // 1: originalDienst (type=0)
      // no type=1 lookup needed
      [{ iddeelnemer: TARGET_ID }],                                   // 2: targetInGroup
      [],                                                             // 3: existingProposal (none)
    ];
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(201);
    expect(res._json).toEqual({ success: true });
    expect(lastInsertValues).toMatchObject({
      type: 4,
      status: 'pending',
      iddienstovern: 500,
      iddeelnemer: 99,
      iddeelnovern: TARGET_ID,
      senderId: SENDER_ID,
    });
  });

  // -- Type=1 → type=0 resolution --

  it('resolves type=1 slot to overlapping type=0 with NULL id (legacy PHP data)', async () => {
    // This is the exact scenario from the original bug:
    // type=0 rows have id=null, same van/tot as the type=1 slot
    selectResults = [
      [{ id: SENDER_ID }],                                           // 0: proposingDoctor
      [{ id: 500, type: 1, van: VAN, tot: TOT, iddeelnemer: 0, idwaarneemgroep: WG }],  // 1: originalDienst (type=1 slot)
      [{ id: null, type: 0, van: VAN, tot: TOT, iddeelnemer: 1305, idwaarneemgroep: WG }],  // 2: type=0 candidate (null id!)
      [{ iddeelnemer: TARGET_ID }],                                   // 3: targetInGroup
      [],                                                             // 4: existingProposal (none)
    ];
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(201);
    expect(res._json).toEqual({ success: true });
    // Should use the type=1 slot id (500) since type=0 has null id, but deelnemer from type=0
    expect(lastInsertValues).toMatchObject({
      type: 4,
      status: 'pending',
      iddienstovern: 500,       // kept from type=1 slot
      iddeelnemer: 1305,         // from type=0 assignment
      iddeelnovern: TARGET_ID,
      senderId: SENDER_ID,
      van: VAN,
      tot: TOT,
    });
  });

  it('resolves type=1 slot to overlapping type=0 with valid id', async () => {
    selectResults = [
      [{ id: SENDER_ID }],                                           // 0: proposingDoctor
      [{ id: 500, type: 1, van: VAN, tot: TOT, iddeelnemer: 0, idwaarneemgroep: WG }],
      [{ id: 600, type: 0, van: VAN, tot: TOT, iddeelnemer: 99, idwaarneemgroep: WG }],  // type=0 with valid id
      [{ iddeelnemer: TARGET_ID }],
      [],
    ];
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(201);
    // Should use the type=0's id when it has one
    expect(lastInsertValues).toMatchObject({
      iddienstovern: 600,
      iddeelnemer: 99,
    });
  });

  it('clamps van/tot to type=0 bounds when type=0 is narrower than type=1', async () => {
    const narrowVan = VAN + 3600;   // 1 hour later
    const narrowTot = TOT - 3600;   // 1 hour earlier
    selectResults = [
      [{ id: SENDER_ID }],
      [{ id: 500, type: 1, van: VAN, tot: TOT, iddeelnemer: 0, idwaarneemgroep: WG }],
      [{ id: null, type: 0, van: narrowVan, tot: narrowTot, iddeelnemer: 55, idwaarneemgroep: WG }],
      [{ iddeelnemer: TARGET_ID }],
      [],
    ];
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(201);
    expect(lastInsertValues).toMatchObject({
      van: narrowVan,
      tot: narrowTot,
    });
  });

  it('returns 400 when type=1 slot has no overlapping type=0 assignment', async () => {
    selectResults = [
      [{ id: SENDER_ID }],
      [{ id: 500, type: 1, van: VAN, tot: TOT, iddeelnemer: 0, idwaarneemgroep: WG }],
      [],  // no type=0 candidates found
    ];

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Only assigned shifts (type=0) can be taken over' });
  });

  it('picks the smallest-span type=0 candidate when multiple overlap', async () => {
    const wideVan = VAN - 7200;
    const wideTot = TOT + 7200;
    selectResults = [
      [{ id: SENDER_ID }],
      [{ id: 500, type: 1, van: VAN, tot: TOT, iddeelnemer: 0, idwaarneemgroep: WG }],
      [
        { id: null, type: 0, van: wideVan, tot: wideTot, iddeelnemer: 11, idwaarneemgroep: WG },   // wider span
        { id: null, type: 0, van: VAN, tot: TOT, iddeelnemer: 22, idwaarneemgroep: WG },            // exact match (smallest)
      ],
      [{ iddeelnemer: TARGET_ID }],
      [],
    ];
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(201);
    // Should pick the exact-match (smaller span) candidate
    expect(lastInsertValues).toMatchObject({ iddeelnemer: 22 });
  });

  // -- Other guards --

  it('returns 404 when original dienst does not exist', async () => {
    selectResults = [
      [{ id: SENDER_ID }],
      [],  // originalDienst not found
    ];

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(404);
    expect(res._json).toEqual({ error: 'Dienst not found' });
  });

  it('returns 400 when target doctor is not in the waarneemgroep', async () => {
    selectResults = [
      [{ id: SENDER_ID }],
      [{ id: 500, type: 0, van: VAN, tot: TOT, iddeelnemer: 99, idwaarneemgroep: WG }],
      [],  // targetInGroup not found
    ];

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Target doctor is not in the same waarneemgroep' });
  });

  it('returns 409 when a pending proposal already exists', async () => {
    selectResults = [
      [{ id: SENDER_ID }],
      [{ id: 500, type: 0, van: VAN, tot: TOT, iddeelnemer: 99, idwaarneemgroep: WG }],
      [{ iddeelnemer: TARGET_ID }],
      [{ id: 333 }],  // existingProposal found
    ];

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(409);
    expect(res._json).toEqual({ error: 'Active proposal already exists for this shift' });
  });

  it('returns 400 when proposing doctor is not found', async () => {
    selectResults = [
      [],  // proposingDoctor not found
    ];

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ error: 'Proposing doctor not found' });
  });
});
