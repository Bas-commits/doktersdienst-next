import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest } from 'next';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  hasGroupManagementAccess: vi.fn(),
  isUserInWaarneemgroep: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
  hasGroupManagementAccess: mocks.hasGroupManagementAccess,
  isUserInWaarneemgroep: mocks.isUserInWaarneemgroep,
}));

vi.mock('./feature-flag', () => ({
  isPraktijkplannerEnabled: () => true,
}));

vi.mock('@/db', () => ({
  db: {},
  schema: {},
}));

import { resolvePraktijkplannerAccess } from './access';

const request = {} as NextApiRequest;

describe('resolvePraktijkplannerAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: 11,
      email: 'participant@example.test',
      idgroep: 1,
      isAdmin: false,
    });
    mocks.isUserInWaarneemgroep.mockResolvedValue(true);
    mocks.hasGroupManagementAccess.mockResolvedValue(false);
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    await expect(resolvePraktijkplannerAccess(request, 9, 'activiteiten:read')).resolves.toEqual({
      ok: false,
      error: { status: 401, error: 'Niet ingelogd.' },
    });
  });

  it('allows an active participant to read personal planner data', async () => {
    await expect(resolvePraktijkplannerAccess(request, 9, 'activiteiten:read')).resolves.toMatchObject({
      ok: true,
      access: { idwaarneemgroep: 9, isMember: true, isManager: false },
    });
  });

  it('denies cross-group access before disclosing planner data', async () => {
    mocks.isUserInWaarneemgroep.mockResolvedValue(false);

    await expect(resolvePraktijkplannerAccess(request, 9, 'activiteiten:read')).resolves.toEqual({
      ok: false,
      error: { status: 403, error: 'Geen toegang tot deze waarneemgroep.' },
    });
  });

  it('requires manager authority for group mutations', async () => {
    await expect(resolvePraktijkplannerAccess(request, 9, 'activiteiten:manage')).resolves.toEqual({
      ok: false,
      error: {
        status: 403,
        error: 'Deze actie is alleen beschikbaar voor secretarissen en beheerders.',
      },
    });
  });

  it('requires a global administrator for master-data management', async () => {
    mocks.hasGroupManagementAccess.mockResolvedValue(true);

    await expect(resolvePraktijkplannerAccess(request, 9, 'beheer:manage')).resolves.toEqual({
      ok: false,
      error: { status: 403, error: 'Deze actie is alleen beschikbaar voor beheerders.' },
    });
  });
});
