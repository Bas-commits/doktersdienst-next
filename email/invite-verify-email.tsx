import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type InviteVerifyEmailProps = {
  /** Link om het e-mailadres te bevestigen en de uitnodiging af te ronden. */
  verifyUrl?: string;
  siteUrl?: string;
  logoSrc?: string;
  /** Optioneel: naam van degene die uitnodigt. */
  invitedByName?: string | null;
};

const DEMO_VERIFY =
  'https://voorbeeld.nl/demo-e-mail-bevestigen-uitnodiging-doktersdienst';

export default function InviteVerifyEmail({
  verifyUrl = DEMO_VERIFY,
  siteUrl = '',
  logoSrc,
  invitedByName,
}: InviteVerifyEmailProps = {}) {
  const inviter = invitedByName?.trim();
  const inviterLine = inviter
    ? `${inviter} heeft je uitgenodigd om mee te doen met De Doktersdienst.`
    : 'Je bent uitgenodigd om mee te doen met De Doktersdienst.';

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
      <Text style={paragraphStyle}>{inviterLine}</Text>
      <Text style={paragraphStyle}>
        Om je account te activeren en verder te gaan, willen we graag weten
        dat dit e-mailadres van jou is. Bevestig daarom je e-mailadres via de
        knop hieronder.
      </Text>
      <Text style={paragraphStyle}>
        Zodra je je e-mail hebt bevestigd, kun je de volgende stappen in het
        platform volgen. Heb je deze uitnodiging niet verwacht? Dan kun je deze
        e-mail negeren.
      </Text>

      <PrimaryButton href={verifyUrl}>E-mailadres bevestigen</PrimaryButton>

      <LinkFallback actionUrl={verifyUrl} />
    </DoktersdienstShell>
  );
}
