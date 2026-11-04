import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type ActionLinkEmailProps = {
  previewText?: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  /** Shown below the button (plain text). */
  footer?: string;
};

export default function ActionLinkEmail({
  previewText,
  title,
  intro,
  actionLabel,
  actionUrl,
  footer,
}: ActionLinkEmailProps) {
  return (
    <Html lang="nl">
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body
        style={{
          margin: 0,
          backgroundColor: '#f6f6f6',
          fontFamily:
            'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
        }}
      >
        <Section style={{ padding: '24px 16px' }}>
          <Container
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e5e5',
              padding: '32px 28px',
            }}
          >
            <Heading
              as="h1"
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#111111',
                margin: '0',
              }}
            >
              {title}
            </Heading>
            <Text
              style={{
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#333333',
                marginTop: '16px',
                marginBottom: '0',
                whiteSpace: 'pre-wrap',
              }}
            >
              {intro}
            </Text>
            <Section style={{ textAlign: 'center', margin: '24px 0 20px' }}>
              <Button
                href={actionUrl}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#111111',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                {actionLabel}
              </Button>
            </Section>
            {footer ? (
              <Text
                style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: '#666666',
                  marginTop: '0',
                  marginBottom: '0',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {footer}
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: '#666666',
                  marginTop: '0',
                  marginBottom: '0',
                  whiteSpace: 'pre-wrap',
                }}
              >
                Als de knop niet werkt, kopieer en plak deze link in je browser:
              </Text>
            )}
            {!footer ? (
              <Text
                style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: '#111111',
                  marginTop: '8px',
                  marginBottom: '0',
                  wordBreak: 'break-all' as const,
                }}
              >
                <Link href={actionUrl} style={{ color: '#111111' }}>
                  {actionUrl}
                </Link>
              </Text>
            ) : null}
          </Container>
        </Section>
      </Body>
    </Html>
  );
}
