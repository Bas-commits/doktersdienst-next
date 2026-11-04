export const GROEP_DEELNEMER = 1 as const;
export const GROEP_SECRETARIS = 2 as const;
export const GROEP_ADMINISTRATOR = 5 as const;

export type RoleTier = typeof GROEP_DEELNEMER | typeof GROEP_SECRETARIS | typeof GROEP_ADMINISTRATOR;

export function normalizeRoleTier(idgroep: number | null | undefined): RoleTier {
  if (idgroep === GROEP_ADMINISTRATOR) return GROEP_ADMINISTRATOR;
  if (idgroep === GROEP_SECRETARIS) return GROEP_SECRETARIS;
  return GROEP_DEELNEMER;
}

export function hasSecretarisAccess(roleTier: RoleTier): boolean {
  return roleTier === GROEP_SECRETARIS || roleTier === GROEP_ADMINISTRATOR;
}

export function hasAdminAccess(roleTier: RoleTier): boolean {
  return roleTier === GROEP_ADMINISTRATOR;
}

type EffectiveRoleTierInput = {
  globalIdgroep: number | null | undefined;
  selectedWaarneemgroepIdgroep: number | null | undefined;
};

export function deriveEffectiveRoleTier({
  globalIdgroep,
  selectedWaarneemgroepIdgroep,
}: EffectiveRoleTierInput): RoleTier {
  if (globalIdgroep === GROEP_ADMINISTRATOR) return GROEP_ADMINISTRATOR;
  if (selectedWaarneemgroepIdgroep === GROEP_SECRETARIS) return GROEP_SECRETARIS;
  return GROEP_DEELNEMER;
}
