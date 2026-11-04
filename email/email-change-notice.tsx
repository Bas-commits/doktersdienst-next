import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type EmailChangeNoticeEmailProps = {
  /** Het adres dat nu nog de login is, en waar deze melding naartoe gaat. */
  oldEmail?: string;
  /** Het aangevraagde adres, zodat de lezer ziet waar het heen zou gaan. */
  newEmail?: string;
  userName?: string | null;
  beheerderEmail?: string;
  beheerderTelefoon?: string;
  siteUrl?: string;
  logoSrc?: string;
};

/**
 * Melding naar het huidige e-mailadres dat er een wijziging is aangevraagd.
 *
 * Deze mail heeft met opzet geen knop en geen link. Hij gaat naar het oude
 * adres, en dat is nu juist het adres dat niets hoeft te bevestigen. Wie deze
 * mail krijgt zonder er iets voor te hebben gedaan, weet daarmee dat iemand
 * anders bij het account kan.
 */
export default function EmailChangeNoticeEmail({
  oldEmail = 'oud@voorbeeld.nl',
  newEmail = 'nieuw@voorbeeld.nl',
  userName,
  beheerderEmail = 'beheerder@voorbeeld.nl',
  beheerderTelefoon = '0600000000',
  siteUrl = '',
  logoSrc,
}: EmailChangeNoticeEmailProps = {}) {
  const name = userName?.trim();
  const greeting = name ? `Hallo ${name},` : 'Hallo,';

  return (
    <DoktersdienstShell
      previewText="Er is een wijziging van uw e-mailadres aangevraagd"
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        Er is een wijziging van uw e-mailadres aangevraagd
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Voor uw account bij De Doktersdienst is aangevraagd om het e-mailadres te
        wijzigen van {oldEmail} naar {newEmail}.
      </Text>
      <Text style={paragraphStyle}>
        U hoeft hier niets voor te doen. Naar het nieuwe adres is een
        bevestigingsmail gestuurd. Pas als die bevestiging is gevolgd, verandert
        uw loginnaam. Tot die tijd logt u gewoon in met {oldEmail}. Uw wachtwoord
        blijft hetzelfde.
      </Text>
      <Text style={paragraphStyle}>
        Heeft u dit niet zelf aangevraagd? Neem dan meteen contact op met de
        beheerder via {beheerderEmail} of {beheerderTelefoon}.
      </Text>
    </DoktersdienstShell>
  );
}
