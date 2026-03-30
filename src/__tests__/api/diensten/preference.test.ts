import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// --- Mocks ---

const mockDelete = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockResolvedValue(undefined);

mockDelete.mockReturnValue({ where: mockWhere });
mockInsert.mockReturnValue({ values: mockValues });

const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
  await cb({ delete: mockDelete, insert: mockInsert });
});

vi.mock('@/db', () => ({
  db: { transaction: mockTransaction },
  schema: {
    diensten: {
      van: 'van',
      tot: 'tot',
      idwaarneemgroep: 'idwaarneemgroep',
      iddeelnemer: 'iddeelnemer',
      type: 'type',
    },
  },
}));

const mockGetSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

const mockLoggerError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Drizzle operator mocks — the handler calls and(), eq(), inArray() but we only
// need them to not throw; actual SQL generation is a DB concern.
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

// --- Helpers ---

function createMockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { cookie: 'session=abc' },
    body: {
      action: 'add',
      van: 1000,
      tot: 2000,
      idwaarneemgroep: 9,
      type: 3,
      currentDate: '2026-03-01 08:00:00',
      nextDate: '2026-03-01 12:30:00',
    },
    ...overrides,
  } as unknown as NextApiRequest;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    _json: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; _json: unknown };
}

// --- Tests ---

describe('POST /api/diensten/preference', () => {
  let handler: typeof import('@/pages/api/diensten/preference').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: '119' } });
    mockTransaction.mockImplementation(async (cb) => {
      await cb({ delete: mockDelete, insert: mockInsert });
    });
    handler = (await import('@/pages/api/diensten/preference')).default;
  });

  // --- Validation ---

  it('rejects non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects unauthenticated requests', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid action', async () => {
    const req = createMockReq({ body: { action: 'invalid', van: 1, tot: 2, idwaarneemgroep: 9 } });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json).toEqual({ error: 'Missing or invalid action (use add or remove)' });
  });

  it('rejects add with invalid type', async () => {
    const req = createMockReq({ body: { action: 'add', van: 1, tot: 2, idwaarneemgroep: 9, type: 999 } });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json).toEqual({ error: 'Missing or invalid type for add (use 2, 3, 9, 10, or 5001)' });
  });

  it('rejects missing van/tot/idwaarneemgroep', async () => {
    const req = createMockReq({ body: { action: 'add', type: 3 } });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json).toEqual({ error: 'Missing or invalid van, tot, or idwaarneemgroep' });
  });

  // --- Successful operations ---

  it('successfully adds a preference', async () => {
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('successfully removes a preference', async () => {
    const req = createMockReq({ body: { action: 'remove', van: 1000, tot: 2000, idwaarneemgroep: 9 } });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // --- Error handling ---

  it('returns 500 and logs error with pino on database failure', async () => {
    const dbError = new Error('connection refused');
    mockTransaction.mockRejectedValue(dbError);

    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._json).toEqual({ error: 'connection refused' });

    // Verify pino logger.error was called with structured context
    expect(mockLoggerError).toHaveBeenCalledOnce();
    const [context, message] = mockLoggerError.mock.calls[0];
    expect(message).toBe('Failed to save preference');
    expect(context.err).toBe(dbError);
    expect(context.action).toBe('add');
    expect(context.van).toBe(1000);
    expect(context.tot).toBe(2000);
    expect(context.idwaarneemgroep).toBe(9);
    expect(context.idDeelnemer).toBe(119);
  });

  it('treats duplicate key errors as success (idempotent)', async () => {
    mockTransaction.mockRejectedValue(new Error('unique constraint violation on diensten_one_preference_per_slot_user'));

    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ success: true });
    // Duplicate key errors should NOT be logged as errors
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('returns error message for non-Error thrown values', async () => {
    mockTransaction.mockRejectedValue('string error');

    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._json).toEqual({ error: 'Internal server error' });
    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});
