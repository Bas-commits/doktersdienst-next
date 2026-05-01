import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type ResetPasswordPurpose = 'reset' | 'setup';

export type ResetPasswordEmailProps = {
  resetUrl?: string;
  siteUrl?: string;
  logoSrc?: string;
  userName?: string | null;
  /**
   * `'reset'`: gebruiker vroeg reset aan; `'setup'`: eerste keer wachtwoord
   * (bijv. na account door beheerder).
   */
  purpose?: ResetPasswordPurpose;
};

const DEMO_RESET =
  'https://voorbeeld.nl/demo-reset-wachtwoord-token-beperkt-geldig';

export default function ResetPasswordEmail({
  resetUrl = DEMO_RESET,
  siteUrl = '',
  logoSrc,
  userName,
  purpose = 'reset',
}: ResetPasswordEmailProps = {}) {
  const name = userName?.trim();
  const greeting = name ? `Hallo ${name},` : 'Hallo,';

  if (purpose === 'setup') {
    return (
      <DoktersdienstShell
        previewText="Stel je wachtwoord in voor De Doktersdienst"
        siteUrl={siteUrl}
        logoSrc={logoSrc}
      >
        <Heading as="h1" style={headingStyle}>
          Welkom bij De Doktersdienst
        </Heading>
        <Text style={paragraphStyle}>{greeting}</Text>
        <Text style={paragraphStyle}>
          Er is een account voor je aangemaakt in De Doktersdienst. Om veilig
          in te loggen, stel je nu een wachtwoord in via de knop hieronder.
        </Text>
        <Text style={paragraphStyle}>
          Deze link is maar korte tijd geldig en is persoonlijk. Deel hem niet
          met anderen. Herken je deze mail niet? Neem dan contact op met je
          beheerder.
        </Text>

        <PrimaryButton href={resetUrl}>Wachtwoord instellen</PrimaryButton>

        <LinkFallback actionUrl={resetUrl} />
      </DoktersdienstShell>
    );
  }

  return (
    <DoktersdienstShell
      previewText="Je wachtwoord voor De Doktersdienst resetten"
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        Wachtwoord opnieuw instellen
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        We hebben een verzoek ontvangen om het wachtwoord van je account bij De
        Doktersdienst te wijzigen. Dat kan per ongeluk gebeuren — geen zorgen.
      </Text>
      <Text style={paragraphStyle}>
        Ben jij dit niet geweest? Dan kun je deze e-mail veilig negeren. Je
        huidige wachtwoord blijft dan gewoon actief.
      </Text>
      <Text style={paragraphStyle}>
        Wil je wél een nieuw wachtwoord? Gebruik dan de knop hieronder. Deze
        link is beperkt geldig.
      </Text>

      <PrimaryButton href={resetUrl}>Nieuw wachtwoord instellen</PrimaryButton>

      <LinkFallback actionUrl={resetUrl} />
    </DoktersdienstShell>
  );
}
