import { Heading, Hr, Section, Text } from '@react-email/components';
import { DoktersdienstShell, headingStyle, paragraphStyle } from './components/doktersdienst-shell';

export type PraktijkplannerScheduleEntry = {
  datum: string;
  dagdeel: string;
  activiteit: string;
  locatie?: string | null;
  taken?: string[];
};

export type PraktijkplannerScheduleEmailProps = {
  userName?: string | null;
  plannerType: 'activiteiten' | 'afwezigheden';
  entries: PraktijkplannerScheduleEntry[];
  siteUrl?: string;
  logoSrc?: string;
};

export default function PraktijkplannerScheduleEmail({
  userName,
  plannerType,
  entries,
  siteUrl = '',
  logoSrc,
}: PraktijkplannerScheduleEmailProps) {
  const isAbsence = plannerType === 'afwezigheden';
  const title = isAbsence ? 'Uw afwezigheden' : 'Uw activiteitenplanning';
  const greeting = userName?.trim() ? `Hallo ${userName.trim()},` : 'Hallo,';

  return (
    <DoktersdienstShell
      previewText={`${title} uit Praktijkplanner`}
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        {title}
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Hieronder staat het actuele overzicht uit Praktijkplanner.
      </Text>
      <Section>
        {entries.map((entry, index) => (
          <Section key={`${entry.datum}-${entry.dagdeel}-${index}`} style={{ padding: '8px 0' }}>
            <Text style={{ ...paragraphStyle, margin: '0', fontWeight: 700 }}>
              {entry.datum} · {entry.dagdeel}
            </Text>
            <Text style={{ ...paragraphStyle, margin: '2px 0 0' }}>{entry.activiteit}</Text>
            {entry.locatie ? (
              <Text style={{ ...paragraphStyle, margin: '2px 0 0' }}>Locatie: {entry.locatie}</Text>
            ) : null}
            {entry.taken?.length ? (
              <Text style={{ ...paragraphStyle, margin: '2px 0 0' }}>
                Taken: {entry.taken.join(', ')}
              </Text>
            ) : null}
            {index < entries.length - 1 ? <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0' }} /> : null}
          </Section>
        ))}
      </Section>
    </DoktersdienstShell>
  );
}
