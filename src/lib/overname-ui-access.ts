import {
  GROEP_ADMINISTRATOR,
  GROEP_SECRETARIS,
  type RoleTier,
} from '@/lib/roles';

/** Shown when a user taps a disabled overname control. */
export const OVERNAME_ACTION_FORBIDDEN_TOAST =
  'U kunt overnames enkel wijzigen als ze u betreffen of als u secretaris bent';

export type OvernameActionCaps = {
  canRespondPending: boolean;
  canManageProposalLifecycle: boolean;
};

function isElevatedStaff(
  globalIdgroep: number | null | undefined,
  roleTier: RoleTier
): boolean {
  if (globalIdgroep === GROEP_ADMINISTRATOR) return true;
  if (roleTier === GROEP_SECRETARIS) return true;
  if (roleTier === GROEP_ADMINISTRATOR) return true;
  return false;
}

/**
 * Mirrors client-side rules aligned with `/api/overnames/respond`.
 * Elevated staff: global administrator or secretary in selected waarneemgroep (`roleTier`).
 */
export function computeOvernameCaps(input: {
  currentDeelnemerId: number;
  globalIdgroep: number | null | undefined;
  roleTier: RoleTier;
  middleId?: number | null;
  senderId?: number | null;
}): OvernameActionCaps {
  const elevated = isElevatedStaff(input.globalIdgroep, input.roleTier);

  const targetId =
    input.middleId != null && Number.isFinite(input.middleId)
      ? input.middleId
      : null;
  const sid =
    input.senderId != null && Number.isFinite(Number(input.senderId))
      ? Number(input.senderId)
      : 0;

  const canRespondPending =
    elevated ||
    (targetId !== null &&
      Number.isFinite(input.currentDeelnemerId) &&
      targetId === input.currentDeelnemerId);

  const canManageProposalLifecycle =
    elevated ||
    (sid > 0 &&
      Number.isFinite(input.currentDeelnemerId) &&
      sid === input.currentDeelnemerId);

  return { canRespondPending, canManageProposalLifecycle };
}

/** Who may submit a nieuw voorstel voor an assigned shift (calendar strip). */
export function canCurrentUserProposeOvername(input: {
  currentDeelnemerId: number;
  globalIdgroep: number | null | undefined;
  roleTier: RoleTier;
  assignedMiddleId?: number | null;
}): boolean {
  if (!Number.isFinite(input.currentDeelnemerId)) return false;

  const elevated = isElevatedStaff(input.globalIdgroep, input.roleTier);

  const mid =
    input.assignedMiddleId != null &&
    Number.isFinite(Number(input.assignedMiddleId))
      ? Number(input.assignedMiddleId)
      : null;

  return elevated || (mid !== null && mid === input.currentDeelnemerId);
}
