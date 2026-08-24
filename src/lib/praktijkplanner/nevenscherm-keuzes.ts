import type { PlannerNevenscherm } from '@/hooks/praktijkplanner/usePlannerWeergave';

/**
 * Welke nevenschermen een roosterscherm aanbiedt naast de week.
 *
 * Dit hing eerder alleen aan de rol, en dat is niet genoeg. Rooster inzien is hetzelfde
 * scherm als de Activiteiten planner, alleen alleen-lezen, dus een beheerder die zijn eigen
 * rooster kwam inzien kreeg daar ook Capaciteit en Expertise te zien. Die twee zijn er voor wie
 * plant. Wie alleen komt kijken heeft aan Week en Maand genoeg.
 *
 * Capaciteit blijft daarnaast aan de beheerder voorbehouden, net als de eigen pagina ervan.
 * Een knop aanbieden die op een 403 uitloopt is erger dan geen knop.
 *
 * Args:
 *     alleenLezen: Of dit Rooster inzien is. Niet hetzelfde als "mag niet plannen".
 *     isBeheerder: Of deze gebruiker secretaris of beheerder is. De Activiteiten planner
 *         staat alleen in het menu van de secretaris, dus een dokter komt daar normaal niet.
 *         De derde uitkomst hieronder geldt dus alleen voor wie het adres intypt, en houdt
 *         het gedrag zoals het was.
 */
export function nevenschermKeuzes(opties: {
  alleenLezen: boolean;
  isBeheerder: boolean;
}): readonly PlannerNevenscherm[] {
  if (opties.alleenLezen) return ['geen', 'maand'];
  if (opties.isBeheerder) return ['geen', 'maand', 'capaciteit', 'expertise'];
  return ['geen', 'maand', 'expertise'];
}
