import type { PraktijkplannerTaskType } from '@/types/praktijkplanner';

/**
 * Plant deze waarneemgroep diensten als taak?
 *
 * Af te leiden en niet apart in te stellen: een groep die geen enkel taaktype als dienst heeft
 * aangemerkt heeft niets om een dienstvoorkeur over te hebben. Groepen die de dienstenplanner
 * gebruiken vallen daar vanzelf onder, want die zetten dit vinkje niet aan.
 */
export function groepPlantDiensten(tasks: readonly PraktijkplannerTaskType[]): boolean {
  return tasks.some((taak) => taak.isDienst);
}

/**
 * De naam van het afwezigheidsscherm van de dokter.
 *
 * Zodra er dienstvoorkeuren op kunnen dekt "Afwezigheidsplanner" de lading niet meer. Andersom
 * is "Afwezigheids- en dienstvoorkeur" misleidend voor een groep die hier geen diensten plant,
 * dus de naam volgt hetzelfde signaal als de blokjes zelf.
 */
export function dokterAfwezigheidsschermTitel(plantDiensten: boolean): string {
  return plantDiensten ? 'Afwezigheids- en dienstvoorkeur' : 'Afwezigheidsplanner dokter';
}

/** De taaktypen die een dienst zijn, op id. */
export function dienstTaakIds(tasks: readonly PraktijkplannerTaskType[]): Set<number> {
  return new Set(tasks.filter((taak) => taak.isDienst).map((taak) => taak.id));
}

/**
 * Hoort deze regel uit het capaciteitsoverzicht bij een diensttaak?
 *
 * De sleutels komen van de server en zien eruit als "taak:12" of "groepstaak:12". Op een
 * dagdeel dat de groep heeft uitgezet zijn dit de enige regels die er mogen staan.
 */
export function isDiensteis(key: string, diensten: ReadonlySet<number>): boolean {
  const [soort, id] = key.split(':');
  return (soort === 'taak' || soort === 'groepstaak') && diensten.has(Number(id));
}
