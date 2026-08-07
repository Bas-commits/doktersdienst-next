/**
 * Contactgegevens van de beheerder van Doktersdienst.
 *
 * Staan op één plek omdat ze op meer dan één scherm nodig zijn: bovenin de
 * header op elke pagina, en in de uitleg bij het vergrendelde e-mailveld in
 * Mijn gegevens. Alleen de beheerder mag een login-e-mailadres wijzigen, dus
 * iedereen die dat wil moet weten waar hij dat kan vragen.
 */

export const BEHEERDER_EMAIL = 'bveltenaar@sivision.nl';

export const BEHEERDER_TELEFOON = '0624235212';

/** Uitleg bij het vergrendelde e-mailveld. */
export const BEHEERDER_WIJZIGT_EMAIL_TEKST =
  `Het e-mailadres voor inloggen kan alleen door de beheerder van Doktersdienst ` +
  `worden gewijzigd, niet door de deelnemer of de secretaris. ` +
  `Neem contact op via ${BEHEERDER_EMAIL} of ${BEHEERDER_TELEFOON}.`;

/** Afwijzing als iemand zonder beheerdersrol toch een wachtwoord probeert te zetten. */
export const BEHEERDER_WIJZIGT_WACHTWOORD_TEKST =
  `Het wachtwoord kan alleen door de beheerder van Doktersdienst worden gewijzigd. ` +
  `Neem contact op via ${BEHEERDER_EMAIL} of ${BEHEERDER_TELEFOON}.`;
