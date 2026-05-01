import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type ResetPasswordEmailProps = {
  /** Link om een nieuw wachtwoord in te stellen. */
  resetUrl?: string;
  siteUrl?: string;
  logoSrc?: string;
  userName?: string | null;
};

const DEMO_RESET =
  'https://voorbeeld.nl/demo-reset-wachtwoord-token-beperkt-geldig';

export default function ResetPasswordEmail({
  resetUrl = DEMO_RESET,
  siteUrl = '',
  logoSrc,
  userName,
}: ResetPasswordEmailProps = {}) {
  const name = userName?.trim();
  const greeting = name ? `Hallo ${name},` : 'Hallo,';

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
