import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type VerifyEmailVariant = 'invite' | 'signup' | 'email_change';

export type InviteVerifyEmailProps = {
  verifyUrl?: string;
  siteUrl?: string;
  logoSrc?: string;
  /** `'invite'`: uitnodiging; `'signup'`: na registratie via Better Auth */
  variant?: VerifyEmailVariant;
  /** Alleen gebruikt bij `signup`: naam uit registratieprofiel */
  accountName?: string | null;
  /** Alleen voor `variant: 'invite'`: naam van degene die uitnodigt. */
  invitedByName?: string | null;
};

const DEMO_VERIFY =
  'https://voorbeeld.nl/demo-e-mail-bevestigen-uitnodiging-doktersdienst';

export default function InviteVerifyEmail({
  verifyUrl = DEMO_VERIFY,
  siteUrl = '',
  logoSrc,
  variant = 'invite',
  accountName,
  invitedByName,
}: InviteVerifyEmailProps = {}) {
  const inviter = invitedByName?.trim();
  const inviteLine = inviter
    ? `${inviter} heeft je uitgenodigd om mee te doen met De Doktersdienst.`
    : 'Je bent uitgenodigd om mee te doen met De Doktersdienst.';

  if (variant === 'signup') {
    const name = accountName?.trim();
    const greetingLead = name ? `Hallo ${name},` : 'Hallo,';
    return (
      <DoktersdienstShell
        previewText="Bevestig je e-mailadres voor De Doktersdienst"
        siteUrl={siteUrl}
        logoSrc={logoSrc}
      >
        <Heading as="h1" style={headingStyle}>
          Bevestig je e-mailadres
        </Heading>
        <Text style={paragraphStyle}>{greetingLead}</Text>
        <Text style={paragraphStyle}>
          Bedankt voor je registratie bij De Doktersdienst. Voordat je verder
          gaat, vragen we je om te bevestigen dat dit e-mailadres van jou is.
        </Text>
        <Text style={paragraphStyle}>
          Gebruik de knop hieronder om je e-mailadres te bevestigen. De link is
          maar korte tijd geldig. Heb je geen account aangemaakt? Dan kun je
          deze e-mail negeren.
        </Text>

        <PrimaryButton href={verifyUrl}>E-mailadres bevestigen</PrimaryButton>

        <LinkFallback actionUrl={verifyUrl} />
      </DoktersdienstShell>
    );
  }

  if (variant === 'email_change') {
    const name = accountName?.trim();
    const greetingLead = name ? `Hallo ${name},` : 'Hallo,';
    return (
      <DoktersdienstShell
        previewText="Bevestig uw nieuwe e-mailadres voor De Doktersdienst"
        siteUrl={siteUrl}
        logoSrc={logoSrc}
      >
        <Heading as="h1" style={headingStyle}>
          Bevestig uw nieuwe e-mailadres
        </Heading>
        <Text style={paragraphStyle}>{greetingLead}</Text>
        <Text style={paragraphStyle}>
          U heeft een wijziging van uw e-mailadres aangevraagd bij De Doktersdienst.
          Bevestig via de knop hieronder dat dit nieuwe adres van u is.
        </Text>
        <Text style={paragraphStyle}>
          Na bevestiging wordt uw loginnaam bijgewerkt. Uw wachtwoord blijft hetzelfde.
          De link is maar korte tijd geldig. Heeft u deze wijziging niet aangevraagd?
          Negeer dan deze e-mail.
        </Text>

        <PrimaryButton href={verifyUrl}>Nieuw e-mailadres bevestigen</PrimaryButton>

        <LinkFallback actionUrl={verifyUrl} />
      </DoktersdienstShell>
    );
  }

  return (
    <DoktersdienstShell
      previewText="Bevestig je e-mailadres voor De Doktersdienst"
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        Je uitnodiging voor De Doktersdienst
      </Heading>
      <Text style={paragraphStyle}>Hallo,</Text>
      <Text style={paragraphStyle}>{inviteLine}</Text>
      <Text style={paragraphStyle}>
        Om je account te activeren en verder te gaan, willen we graag weten dat
        dit e-mailadres van jou is. Bevestig daarom je e-mailadres via de knop
        hieronder.
      </Text>
      <Text style={paragraphStyle}>
        Direct na bevestiging word je doorgestuurd om een sterk wachtwoord in te
        stellen. Daarmee is je account gereed. Heb je deze uitnodiging niet
        verwacht? Dan kun je deze e-mail negeren.
      </Text>

      <PrimaryButton href={verifyUrl}>E-mailadres bevestigen</PrimaryButton>

      <LinkFallback actionUrl={verifyUrl} />
    </DoktersdienstShell>
  );
}
