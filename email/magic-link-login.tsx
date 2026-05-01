import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type MagicLinkLoginEmailProps = {
  /** Eenmalige magische-inloglink. */
  magicLinkUrl?: string;
  /** Zie DoktersdienstShell — `{siteUrl}/logo.png`; leeg voor e-mail-preview. */
  siteUrl?: string;
  logoSrc?: string;
  userName?: string | null;
};

const DEMO_MAGIC =
  'https://voorbeeld.nl/demo-magic-link-eenmalig-en-beperkt-geldig';

export default function MagicLinkLoginEmail({
  magicLinkUrl = DEMO_MAGIC,
  siteUrl = '',
  logoSrc,
  userName,
}: MagicLinkLoginEmailProps = {}) {
  const name = userName?.trim();
  const greeting = name ? `Hallo ${name},` : 'Hallo,';

  return (
    <DoktersdienstShell
      previewText="Je magische inloglink voor De Doktersdienst"
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        Inloggen op De Doktersdienst
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Je hebt een magische inloglink voor De Doktersdienst aangevraagd. Met één klik log je direct in —
        zo hoef je je wachtwoord niet te typen tijdens deze stap.
      </Text>
      <Text style={paragraphStyle}>
        De onderstaande knop werkt maar één keer en is slechts korte tijd geldig. Open de link daarom zo
        snel mogelijk op het apparaat waar je de aanvraag deed.
      </Text>

      <PrimaryButton href={magicLinkUrl}>Inloggen bij De Doktersdienst</PrimaryButton>

      <LinkFallback actionUrl={magicLinkUrl} />
    </DoktersdienstShell>
  );
}
