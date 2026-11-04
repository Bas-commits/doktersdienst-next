/** Weergavenamen voor legacy `groepen.id` (deelnemer-rol primair voor UI). */

export const ROL_LABELS: Record<number, string> = {
  1: 'Deelnemer',
  2: 'Secretaris',
  3: 'Receptionist',
  4: 'Kijker',
};

export function rolDisplayLabel(id: number | null | undefined): string {
  if (id == null) return '—';
  return ROL_LABELS[id] ?? `Rol ${id}`;
}
