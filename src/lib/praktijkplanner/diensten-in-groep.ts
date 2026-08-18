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
