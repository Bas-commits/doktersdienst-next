import { weekRangeLabel } from './dates';

/**
 * Teksten bij een dagdeel dat bij een herhaling hoort.
 *
 * Het gele bordje op een fiche en de popup bij mouse-over vertellen hetzelfde verhaal, dus
 * staan de zinnen op een plek. Ze noemen de bronweek, want zonder die week zegt een melding
 * alleen dat er iets afwijkt en niet waarvan.
 *
 * Herhalingen van voor de kolom bronstartdatum hebben geen bronweek. Die wordt niet gegokt:
 * een verkeerde week bij een waarschuwing is erger dan geen week.
 */

export function herhalingWeekLabel(bronweek: string): string {
  return weekRangeLabel(bronweek, { withYear: true });
}

/** Uitleg bij een dagdeel dat na het herhalen met de hand is aangepast. */
export function afwijkingTekst(bronweek: string | null): string {
  const aanleiding = 'Dit dagdeel is na het herhalen aangepast';
  return bronweek
    ? `${aanleiding} en wijkt af van de herhaling van week ${herhalingWeekLabel(bronweek)}.`
    : `${aanleiding} en wijkt af van de herhaling. Van welke week die herhaling komt is niet vastgelegd.`;
}

/** Uitleg bij een dagdeel dat ongewijzigd bij een herhaling hoort. */
export function herhalingTekst(bronweek: string | null): string {
  return bronweek
    ? `Herhaling van week ${herhalingWeekLabel(bronweek)}.`
    : 'Onderdeel van een herhaling.';
}
