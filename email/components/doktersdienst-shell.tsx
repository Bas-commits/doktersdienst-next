import type { CSSProperties, ReactNode } from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/** Button & body colors aligned with DoktersDienst branding */
export const doktersColors = {
  bodyBg: '#f3f4f6',
  cardBg: '#ffffff',
  border: '#e8eaed',
  heading: '#333e48',
  text: '#42525c',
  muted: '#64717c',
  accent: '#ff4b5c',
  accentDark: '#e03d50',
  link: '#5b21b6',
} as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export type DoktersdienstShellProps = {
  previewText?: string;
  /**
   * Openbare basis-URL van je app (bijv. https://diensten.jouwdomein.nl).
   * Fallback-logo: `{siteUrl}/logo.png` als noch `logoSrc` noch `EMAIL_LOGO_URL` staat ingesteld.
   */
  siteUrl?: string;
  /**
   * Overschrijft alle andere bronnen (CDN, env, siteUrl).
   * Handig voor tests of een andere afbeelding per mail.
   */
  logoSrc?: string;
  /** Kind content binnen de witte kaart (naast logo). */
  children: ReactNode;
};

/**
 * Gedeelde wrapper: logo, neutrale achtergrond, typografie.
 */
export function DoktersdienstShell({
  previewText,
  siteUrl,
  logoSrc: logoSrcProp,
  children,
}: DoktersdienstShellProps) {
  const trimmed = siteUrl?.trim();
  const explicitLogo = logoSrcProp?.trim();
  const logoFromEnv = process.env.EMAIL_LOGO_URL?.trim();
  const logoSrc =
    explicitLogo !== undefined && explicitLogo.length > 0
      ? explicitLogo
      : logoFromEnv !== undefined && logoFromEnv.length > 0
        ? logoFromEnv
        : trimmed
          ? `${stripTrailingSlash(trimmed)}/logo.png`
          : '/static/logo.png';

  return (
    <Html lang="nl">
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body
        style={{
          margin: 0,
          backgroundColor: doktersColors.bodyBg,
          fontFamily:
            'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
        }}
      >
        <Section style={{ padding: '32px 16px' }}>
          <Container
            style={{
              maxWidth: '520px',
              margin: '0 auto',
              backgroundColor: doktersColors.cardBg,
              borderRadius: '12px',
              border: `1px solid ${doktersColors.border}`,
              padding: '32px 28px 28px',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
            }}
          >
            <Section style={{ marginBottom: '28px', textAlign: 'center' }}>
              <Img
                src={logoSrc}
                width={200}
                alt="DoktersDienst"
                style={{ margin: '0 auto', maxWidth: '100%', height: 'auto' }}
              />
            </Section>
            {children}
            <HrSpacer />
            <Text style={mutedNoteStyle}>
              Deze e-mail is automatisch verstuurd door De Doktersdienst. Dit
              adres wordt niet gelezen — je kunt hier niet op antwoorden.
            </Text>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const mutedNoteStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.55,
  color: doktersColors.muted,
  margin: '0',
};

/** Horizontale scheidingsruimte (geen echte `<hr>`: betere ondersteuning in clients). */
function HrSpacer() {
  return <Section style={{ height: '28px' }} />;
}

export const headingStyle: CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  lineHeight: 1.35,
  color: doktersColors.heading,
  margin: '0',
};

export const paragraphStyle: CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  color: doktersColors.text,
  margin: '16px 0 0',
};

export const anchorFallbackStyle = {
  color: doktersColors.link,
  textDecoration: 'underline',
} as const;

export function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ textAlign: 'center', margin: '28px 0 24px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: doktersColors.accent,
          color: '#ffffff',
          padding: '14px 28px',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: 600,
          boxShadow: `0 2px 0 ${doktersColors.accentDark}`,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function LinkFallback({ actionUrl }: { actionUrl: string }) {
  return (
    <>
      <Text
        style={{
          ...paragraphStyle,
          marginTop: '0',
          fontSize: '13px',
          color: doktersColors.muted,
        }}
      >
        Werkt de knop niet? Kopieer en plak deze link in je browser:
      </Text>
      <Text
        style={{
          fontSize: '13px',
          lineHeight: 1.5,
          margin: '8px 0 0',
          wordBreak: 'break-all' as const,
        }}
      >
        <Link href={actionUrl} style={anchorFallbackStyle}>
          {actionUrl}
        </Link>
      </Text>
    </>
  );
}
