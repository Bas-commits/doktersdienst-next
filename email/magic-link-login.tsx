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
        Je hebt een inloglink voor De Doktersdienst aangevraagd. Met één klik log je direct in, zonder
        je wachtwoord te typen. Je wachtwoord verandert hier niet door en blijft gewoon werken. Wil je
        juist een nieuw wachtwoord kiezen, gebruik dan &quot;wachtwoord vergeten&quot; op de inlogpagina.
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
