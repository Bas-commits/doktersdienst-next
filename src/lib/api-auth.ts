import type { NextApiRequest } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { deelnemers, waarneemgroepdeelnemers } = schema;

export const GROEP_ADMINISTRATOR = 5;
export const GROEP_SECRETARIS = 2;

/** Convert Next.js request headers to Headers for Better Auth */
export function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export type AuthenticatedUser = {
  id: number;
  email: string;
  idgroep: number | null;
  isAdmin: boolean;
};

/**
 * Resolves the current session and looks up the deelnemer record.
 * Returns null if unauthenticated or deelnemer not found.
 */
export async function getAuthenticatedUser(req: NextApiRequest): Promise<AuthenticatedUser | null> {
  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) return null;

  const email = session.user.email;
  if (!email) return null;

  const [row] = await db
    .select({ id: deelnemers.id, idgroep: deelnemers.idgroep })
    .from(deelnemers)
    .where(eq(deelnemers.email, email))
    .limit(1);

  if (!row || row.id === null) return null;

  return {
    id: row.id,
    email,
    idgroep: row.idgroep,
    isAdmin: row.idgroep === GROEP_ADMINISTRATOR,
  };
}

/**
 * Returns the set of waarneemgroep IDs the user is actively registered in.
 */
export async function getUserWaarneemgroepIds(deelnemerId: number): Promise<number[]> {
  const rows = await db
    .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
        eq(waarneemgroepdeelnemers.aangemeld, true)
      )
    );
  return rows
    .map((r) => r.idwaarneemgroep)
    .filter((id): id is number => id !== null);
}

/**
 * Checks if a user is a member of a specific waarneemgroep.
 */
export async function isUserInWaarneemgroep(
  deelnemerId: number,
  idwaarneemgroep: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: waarneemgroepdeelnemers.id })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
        eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
        eq(waarneemgroepdeelnemers.aangemeld, true)
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Checks if a user is a secretaris (idgroep=2) in a specific waarneemgroep.
 */
export async function isSecretarisInWaarneemgroep(
  deelnemerId: number,
  idwaarneemgroep: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: waarneemgroepdeelnemers.id })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, deelnemerId),
        eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
        eq(waarneemgroepdeelnemers.idgroep, GROEP_SECRETARIS)
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Checks if a user has admin or secretaris access for a waarneemgroep.
 * Admins have access to all groups; secretaris only to their own.
 */
export async function hasGroupManagementAccess(
  user: AuthenticatedUser,
  idwaarneemgroep: number
): Promise<boolean> {
  if (user.isAdmin) return true;
  return isSecretarisInWaarneemgroep(user.id, idwaarneemgroep);
}
