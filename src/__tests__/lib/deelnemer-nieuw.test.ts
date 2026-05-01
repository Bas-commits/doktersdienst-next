import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockSelect: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: mockLimit,
      })),
    })),
  })),
}));

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
  },
  schema: {
    groepen: {
      id: 'groepen.id',
      deelnemertoev: 'groepen.deelnemertoev',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

describe('resolveDeelnemerCreatePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    vi.resetModules();
  });

  it('allows administrators without checking deelnemertoev', async () => {
    const { resolveDeelnemerCreatePermission } = await import('@/lib/deelnemer-nieuw');

    const result = await resolveDeelnemerCreatePermission({
      id: 1,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });

    expect(result).toEqual({ ok: true });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('requires deelnemertoev for secretaris accounts', async () => {
    mockLimit.mockResolvedValueOnce([{ deelnemertoev: false }]);
    const { resolveDeelnemerCreatePermission } = await import('@/lib/deelnemer-nieuw');

    const result = await resolveDeelnemerCreatePermission({
      id: 2,
      email: 'secretaris@test.nl',
      idgroep: 2,
      isAdmin: false,
    });

    expect(result).toEqual({
      ok: false,
      forbiddenReason: 'Uw rol heeft geen recht om deelnemers toe te voegen (deelnemertoev staat uit).',
    });
  });
});
