import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  getAuthenticatedUser,
  hasGroupManagementAccess,
  isUserInWaarneemgroep,
  type AuthenticatedUser,
} from '@/lib/api-auth';

export type PraktijkplannerCapability =
  | 'activiteiten:read'
  | 'activiteiten:manage'
  | 'afwezigheid:self'
  | 'afwezigheid:manage'
  | 'dokter-activiteiten:read'
  | 'dokter-afwezigheid:read'
  | 'dokter-afwezigheid:manage'
  | 'capaciteit:read'
  | 'capaciteit:manage'
  | 'beheer:manage';

export type PraktijkplannerAccess = {
  user: AuthenticatedUser;
  idwaarneemgroep: number;
  isMember: boolean;
  isManager: boolean;
};

export type PraktijkplannerAccessError = {
  status: 400 | 401 | 403;
  error: string;
};

export type PraktijkplannerAccessResult =
  | { ok: true; access: PraktijkplannerAccess }
  | { ok: false; error: PraktijkplannerAccessError };

const MANAGER_CAPABILITIES = new Set<PraktijkplannerCapability>([
  'activiteiten:manage',
  'afwezigheid:manage',
  'dokter-afwezigheid:manage',
  'capaciteit:read',
  'capaciteit:manage',
  'beheer:manage',
]);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Resolves the selected group and the caller's authority for Praktijkplanner.
 *
 * The product switch is intentionally available to every authenticated user. The
 * authorization boundary remains the active group: non-admins must be active
 * members, while global administrators may manage every group.
 */
export async function resolvePraktijkplannerAccess(
  req: NextApiRequest,
  idwaarneemgroep: unknown,
  capability: PraktijkplannerCapability
): Promise<PraktijkplannerAccessResult> {
  const groupId = Number(idwaarneemgroep);
  if (!isPositiveInteger(groupId)) {
    return {
      ok: false,
      error: { status: 400, error: 'Een geldige waarneemgroep is verplicht.' },
    };
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return { ok: false, error: { status: 401, error: 'Niet ingelogd.' } };
  }

  const isMember = user.isAdmin || (await isUserInWaarneemgroep(user.id, groupId));
  if (!isMember) {
    return {
      ok: false,
      error: { status: 403, error: 'Geen toegang tot deze waarneemgroep.' },
    };
  }

  const isManager = user.isAdmin || (await hasGroupManagementAccess(user, groupId));
  if (MANAGER_CAPABILITIES.has(capability) && !isManager) {
    return {
      ok: false,
      error: { status: 403, error: 'Deze actie is alleen beschikbaar voor secretarissen en beheerders.' },
    };
  }

  return {
    ok: true,
    access: {
      user,
      idwaarneemgroep: groupId,
      isMember,
      isManager,
    },
  };
}

export function sendPraktijkplannerAccessError(
  res: NextApiResponse,
  result: Extract<PraktijkplannerAccessResult, { ok: false }>
) {
  return res.status(result.error.status).json({ error: result.error.error });
}

/**
 * A participant is addressable only when they are an active member of the
 * selected group. Participants may target themselves; a manager may target any
 * active participant in that group.
 */
export async function canAccessPraktijkplannerParticipant(
  access: PraktijkplannerAccess,
  targetDeelnemerId: unknown,
  options: { allowSelf?: boolean; requireManager?: boolean } = {}
): Promise<boolean> {
  const targetId = Number(targetDeelnemerId);
  if (!isPositiveInteger(targetId)) return false;

  const allowSelf = options.allowSelf ?? true;
  const requireManager = options.requireManager ?? false;
  const isSelf = targetId === access.user.id;

  if (requireManager && !access.isManager) return false;
  if (!isSelf && !access.isManager) return false;
  if (isSelf && !allowSelf) return false;

  return isUserInWaarneemgroep(targetId, access.idwaarneemgroep);
}

export async function getPraktijkplannerParticipants(
  access: PraktijkplannerAccess
): Promise<
  Array<{
    id: number;
    voornaam: string | null;
    achternaam: string | null;
    initialen: string | null;
    color: string | null;
    name: string | null;
  }>
> {
  const { deelnemers, waarneemgroepdeelnemers } = schema;
  const rows = await db
    .select({
      id: deelnemers.id,
      voornaam: deelnemers.voornaam,
      achternaam: deelnemers.achternaam,
      initialen: deelnemers.initialen,
      color: deelnemers.color,
      name: deelnemers.name,
    })
    .from(waarneemgroepdeelnemers)
    .innerJoin(deelnemers, eq(waarneemgroepdeelnemers.iddeelnemer, deelnemers.id))
    .where(
      and(
        eq(waarneemgroepdeelnemers.idwaarneemgroep, access.idwaarneemgroep),
        eq(waarneemgroepdeelnemers.aangemeld, true),
        or(eq(deelnemers.afgemeld, false), isNull(deelnemers.afgemeld))
      )
    );

  const visible = access.isManager ? rows : rows.filter((row) => row.id === access.user.id);
  return visible
    .filter((row): row is typeof row & { id: number } => row.id != null)
    .sort((a, b) => {
      const aName = [a.achternaam, a.voornaam, a.name].filter(Boolean).join(' ');
      const bName = [b.achternaam, b.voornaam, b.name].filter(Boolean).join(' ');
      return aName.localeCompare(bName, 'nl');
    });
}

export function isManagerOnlyCapability(capability: PraktijkplannerCapability): boolean {
  return MANAGER_CAPABILITIES.has(capability);
}
