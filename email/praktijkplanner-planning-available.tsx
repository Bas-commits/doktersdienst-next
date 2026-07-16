import { Heading, Text } from '@react-email/components';
import {
  DoktersdienstShell,
  LinkFallback,
  PrimaryButton,
  headingStyle,
  paragraphStyle,
} from './components/doktersdienst-shell';

export type PraktijkplannerPlanningAvailableEmailProps = {
  userName?: string | null;
  reviewUrl: string;
  siteUrl?: string;
  logoSrc?: string;
};

export default function PraktijkplannerPlanningAvailableEmail({
  userName,
  reviewUrl,
  siteUrl = '',
  logoSrc,
}: PraktijkplannerPlanningAvailableEmailProps) {
  const greeting = userName?.trim() ? `Hallo ${userName.trim()},` : 'Hallo,';

  return (
    <DoktersdienstShell
      previewText="Nieuwe planning beschikbaar in Praktijkplanner"
      siteUrl={siteUrl}
      logoSrc={logoSrc}
    >
      <Heading as="h1" style={headingStyle}>
        Nieuwe planning beschikbaar
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Er is een nieuwe planning voor u beschikbaar in de Praktijkplanner. Wilt
        u deze bekijken en controleren?
      </Text>
      <PrimaryButton href={reviewUrl}>Planning bekijken</PrimaryButton>
      <LinkFallback actionUrl={reviewUrl} />
    </DoktersdienstShell>
  );
}
