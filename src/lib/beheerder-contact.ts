/**
 * Contactgegevens van de beheerder van Doktersdienst.
 *
 * Staan op één plek omdat ze op meer dan één scherm nodig zijn: bovenin de
 * header op elke pagina, in de uitleg bij het vergrendelde e-mailveld van een
 * andere deelnemer, en in de melding die naar een oud e-mailadres gaat.
 *
 * Je eigen e-mailadres en wachtwoord wijzig je zelf. Die van een ander kan
 * alleen de beheerder, dus iedereen die dat wil moet weten waar hij dat vraagt.
 */

export const BEHEERDER_EMAIL = 'bveltenaar@sivision.nl';

export const BEHEERDER_TELEFOON = '0624235212';

/** Uitleg bij het vergrendelde e-mailveld op het profiel van een andere deelnemer. */
export const BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST =
  `Het e-mailadres van een andere deelnemer kan alleen door de beheerder van ` +
  `Doktersdienst worden gewijzigd, niet door de secretaris. ` +
  `Neem contact op via ${BEHEERDER_EMAIL} of ${BEHEERDER_TELEFOON}.`;

/** Afwijzing als iemand zonder beheerdersrol het wachtwoord van een ander probeert te zetten. */
export const BEHEERDER_WIJZIGT_ANDERMANS_WACHTWOORD_TEKST =
  `Het wachtwoord van een andere deelnemer kan alleen door de beheerder van ` +
  `Doktersdienst worden gezet. ` +
  `Neem contact op via ${BEHEERDER_EMAIL} of ${BEHEERDER_TELEFOON}.`;
