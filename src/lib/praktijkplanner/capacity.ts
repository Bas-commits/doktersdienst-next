import type { PraktijkplannerCapacityComparison } from '@/types/praktijkplanner';

/**
 * Keeps the legacy traffic-light intent while handling equal/zero values
 * deterministically: adequate staffing is green, at least half coverage is
 * orange, and missing/less-than-half coverage is red.
 */
export function getCapacityStatus(
  gepland: number,
  benodigd: number
): PraktijkplannerCapacityComparison['status'] {
  if (benodigd <= 0) return 'groen';
  if (gepland >= benodigd) return 'groen';
  if (gepland <= 0) return 'rood';
  return gepland * 2 >= benodigd ? 'oranje' : 'rood';
}

export function compareCapacity(input: {
  key: string;
  label: string;
  gepland: number;
  benodigd: number;
}): PraktijkplannerCapacityComparison {
  return {
    ...input,
    status: getCapacityStatus(input.gepland, input.benodigd),
  };
}
