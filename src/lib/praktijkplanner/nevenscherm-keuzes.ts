import type { PlannerNevenscherm } from '@/hooks/praktijkplanner/usePlannerWeergave';

/**
 * Welke nevenschermen een roosterscherm aanbiedt naast de week.
 *
 * Dit hing eerder alleen aan de rol, en dat is niet genoeg. Rooster inzien is hetzelfde
 * scherm als de Activiteiten planner, alleen alleen-lezen, dus een beheerder die zijn eigen
 * rooster kwam inzien kreeg daar ook Capaciteit en Locatie te zien. Die twee zijn er voor wie
 * plant. Wie alleen komt kijken heeft aan Week en Maand genoeg.
 *
 * Capaciteit blijft daarnaast aan de beheerder voorbehouden, net als de eigen pagina ervan.
 * Een knop aanbieden die op een 403 uitloopt is erger dan geen knop.
 *
 * Args:
 *     alleenLezen: Of dit Rooster inzien is. Niet hetzelfde als "mag niet plannen": een
 *         dokter mag ook op de Activiteiten planner niets wijzigen, maar kijkt daar wel mee
 *         naar de locaties.
 *     isBeheerder: Of deze gebruiker secretaris of beheerder is.
 */
export function nevenschermKeuzes(opties: {
  alleenLezen: boolean;
  isBeheerder: boolean;
}): readonly PlannerNevenscherm[] {
  if (opties.alleenLezen) return ['geen', 'maand'];
  if (opties.isBeheerder) return ['geen', 'maand', 'capaciteit', 'locatie'];
  return ['geen', 'maand', 'locatie'];
}
