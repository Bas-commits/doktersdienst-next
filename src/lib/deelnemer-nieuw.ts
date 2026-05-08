import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  GROEP_SECRETARIS,
  hasGroupManagementAccess,
  type AuthenticatedUser,
} from '@/lib/api-auth';
import { getBetterAuthApiBase } from '@/lib/better-auth-url';
import { ROL_LABELS } from '@/lib/rol-labels';

const { groepen } = schema;

/** Headers with a trusted Origin/Host so Better Auth internal sign-up passes CSRF/origin middleware. */
export function syntheticSignUpTrustHeaders(): Headers {
  const apiBase = getBetterAuthApiBase();
  const origin = new URL(apiBase).origin;
  const host = new URL(apiBase).host;
  const h = new Headers();
  h.set('Origin', origin);
  h.set('Host', host);
  h.set('Content-Type', 'application/json');
  return h;
}

/**
 * Secretaris (idgroep 2) with `groepen.deelnemertoev`, or administrator (idgroep 5).
 */
export async function resolveDeelnemerCreatePermission(
  actor: AuthenticatedUser,
  idwaarneemgroep: number | null
): Promise<
  { ok: true } | { ok: false; forbiddenReason: string }
> {
  if (actor.idgroep === GROEP_ADMINISTRATOR) {
    return { ok: true };
  }

  if (!Number.isFinite(idwaarneemgroep) || !idwaarneemgroep || idwaarneemgroep <= 0) {
    return { ok: false, forbiddenReason: 'Kies eerst een geldige waarneemgroep in de kopbalk.' };
  }

  const mayManageSelectedGroup = await hasGroupManagementAccess(actor, idwaarneemgroep);
  if (!mayManageSelectedGroup) {
    return {
      ok: false,
      forbiddenReason: 'U bent geen secretaris voor de gekozen waarneemgroep.',
    };
  }

  const [row] = await db
    .select({ deelnemertoev: groepen.deelnemertoev })
    .from(groepen)
    .where(eq(groepen.id, GROEP_SECRETARIS))
    .limit(1);
  if (!row?.deelnemertoev) {
    return {
      ok: false,
      forbiddenReason:
        'Uw rol heeft geen recht om deelnemers toe te voegen (deelnemertoev staat uit).',
    };
  }
  return { ok: true };
}

/**
 * Rol-opties voor “Deelnemer toevoegen”: alleen **Deelnemer** en **Secretaris** met vaste weergavenaam (id 1 en 2).
 * Valideert dat de groep‑rijen in `groepen` bestaan.
 */
export async function listGroepChoicesForNewDeelnemer(): Promise<Array<{ id: number; naam: string | null }>> {
  const ordered = [
    { id: GROEP_DEELNEMER, naam: ROL_LABELS[GROEP_DEELNEMER]! },
    { id: GROEP_SECRETARIS, naam: ROL_LABELS[GROEP_SECRETARIS]! },
  ];
  const found = await db
    .select({ id: groepen.id })
    .from(groepen)
    .where(inArray(groepen.id, [GROEP_DEELNEMER, GROEP_SECRETARIS]));
  const present = new Set(found.map((f) => f.id).filter((id): id is number => id != null));
  return ordered.filter((o) => present.has(o.id));
}
