import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

let selectResults: Record<string, unknown>[][] = [];
let selectCallIndex = 0;
let lastUpdateSet: Record<string, unknown> | null = null;
let deleteCalled = false;

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
  chain.set = vi.fn((vals: Record<string, unknown>) => {
    lastUpdateSet = vals;
    return chain;
  });

  return chain;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain = createMockChain();
      return { ...chain, from: vi.fn().mockReturnValue(chain) };
    }),
    update: vi.fn(() => createMockChain()),
    delete: vi.fn(() => {
      deleteCalled = true;
      return createMockChain();
    }),
  },
  schema: {
    diensten: {
      id: 'id', type: 'type', van: 'van', tot: 'tot',
      iddeelnemer: 'iddeelnemer', idwaarneemgroep: 'idwaarneemgroep',
      status: 'status', iddienstovern: 'iddienstovern',
      iddeelnovern: 'iddeelnovern', senderId: 'senderId',
    },
    deelnemers: { id: 'id', login: 'login', idgroep: 'idgroep' },
    waarneemgroepdeelnemers: { idwaarneemgroep: 'idwaarneemgroep', iddeelnemer: 'iddeelnemer', idgroep: 'idgroep' },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: '1', email: 'target@test.nl' } }),
    },
  },
}));

const VAN = 1711918800;
const TOT = 1711951200;
const WG = 9;
const TARGET_ID = 42;
const SENDER_ID = 10;

/** Mirrors `buildOvernameRespondPayload` in the mobile app. */
function mobileRespondBody(
  action: 'accept' | 'decline' | 'delete',
  overrides: Record<string, unknown> = {},
) {
  return {
    iddienstovern: 0,
    action,
    van: VAN,
    tot: TOT,
    idwaarneemgroep: WG,
    iddeelnemer: 1305,
    iddeelnovern: TARGET_ID,
    ...overrides,
  };
}

function makeReq(body: Record<string, unknown>): NextApiRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
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

describe('POST /api/overnames/respond', () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(async () => {
    selectResults = [];
    selectCallIndex = 0;
    lastUpdateSet = null;
    deleteCalled = false;
    vi.clearAllMocks();
    handler = (await import('@/pages/api/overnames/respond')).default;
  });

  it('accepts via mobile composite key when iddienstovern is 0', async () => {
    selectResults = [
      [{ id: TARGET_ID, idgroep: 1 }],
      [{
        id: null,
        iddienstovern: 0,
        iddeelnovern: TARGET_ID,
        iddeelnemer: 1305,
        senderId: SENDER_ID,
        idwaarneemgroep: WG,
        status: 'pending',
        van: VAN,
        tot: TOT,
      }],
      [],
    ];

    const res = makeRes();
    await handler(makeReq(mobileRespondBody('accept')), res);
    expect(res._status).toBe(200);
    expect(lastUpdateSet).toEqual({ type: 6, status: 'accepted' });
  });

  it('declines via overnameId (web header popover shape)', async () => {
    selectResults = [
      [{ id: TARGET_ID, idgroep: 1 }],
      [{
        id: 900,
        iddienstovern: 500,
        iddeelnovern: TARGET_ID,
        iddeelnemer: 1305,
        senderId: SENDER_ID,
        idwaarneemgroep: WG,
        status: 'pending',
        van: VAN,
        tot: TOT,
      }],
      [],
    ];

    const res = makeRes();
    await handler(makeReq({ action: 'decline', iddienstovern: 500, overnameId: 900 }), res);
    expect(res._status).toBe(200);
    expect(lastUpdateSet).toEqual({ status: 'declined' });
  });

  it('deletes declined proposal via mobile deleteStatus payload', async () => {
    selectResults = [
      [{ id: SENDER_ID, idgroep: 1 }],
      [{
        id: 901,
        iddienstovern: 0,
        iddeelnovern: TARGET_ID,
        iddeelnemer: 1305,
        senderId: SENDER_ID,
        idwaarneemgroep: WG,
        status: 'declined',
        van: VAN,
        tot: TOT,
      }],
      [],
    ];

    const res = makeRes();
    await handler(
      makeReq({ ...mobileRespondBody('delete'), deleteStatus: 'declined', overnameId: 901 }),
      res,
    );
    expect(res._status).toBe(200);
    expect(deleteCalled).toBe(true);
  });
});
