import type { CSSProperties } from 'react';
import { Heading, Hr, Section, Text } from '@react-email/components';
import { DoktersdienstShell, doktersColors, headingStyle, paragraphStyle } from './components/doktersdienst-shell';

export type RoosterEmailEntry = {
  datum: string;
  tijd: string;
  deelnemer: string;
  waarneemgroep?: string | null;
};

export type DoktersdienstRoosterEmailProps = {
  userName?: string | null;
  periode: string;
  eigenDiensten: boolean;
  entries: RoosterEmailEntry[];
  bevestiging?: boolean;
  siteUrl?: string;
  logoSrc?: string;
};

const thStyle: CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  color: doktersColors.heading,
  borderBottom: `2px solid ${doktersColors.border}`,
};

const tdStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: '14px',
  color: doktersColors.text,
  borderBottom: `1px solid ${doktersColors.border}`,
};

export default function DoktersdienstRoosterEmail({
  userName,
  periode,
  eigenDiensten,
  entries,
  bevestiging = false,
  siteUrl = '',
  logoSrc,
}: DoktersdienstRoosterEmailProps) {
  const title = bevestiging ? 'Uw diensten ter bevestiging' : eigenDiensten ? 'Uw diensten' : 'Rooster';
  const greeting = userName?.trim() ? `Hallo ${userName.trim()},` : 'Hallo,';
  const intro = bevestiging
    ? `Hieronder staan uw diensten voor ${periode}. Wilt u controleren of dit klopt?`
    : eigenDiensten
      ? `Hieronder staan uw diensten voor ${periode}.`
      : `Hieronder staat het rooster voor ${periode}.`;

  return (
    <DoktersdienstShell previewText={`${title} ${periode}`} siteUrl={siteUrl} logoSrc={logoSrc}>
      <Heading as="h1" style={headingStyle}>
        {title}
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>{intro}</Text>

      {entries.length === 0 ? (
        <Text style={{ ...paragraphStyle, fontStyle: 'italic' }}>
          Geen diensten gevonden in deze periode.
        </Text>
      ) : (
        <Section style={{ marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Datum</th>
                <th style={thStyle}>Tijd</th>
                <th style={thStyle}>Deelnemer</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={`${entry.datum}-${entry.tijd}-${i}`}>
                  <td style={tdStyle}>{entry.datum}</td>
                  <td style={tdStyle}>{entry.tijd}</td>
                  <td style={tdStyle}>{entry.deelnemer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </DoktersdienstShell>
  );
}
