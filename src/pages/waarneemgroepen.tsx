import { GetServerSideProps } from 'next';

/**
 * Redirect legacy /waarneemgroepen to dashboard.
 * Waarneemgroepen are now selected in the header dropdown and available via useWaarneemgroep().
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/dashboard', permanent: false },
});

export default function WaarneemgroepenRedirect() {
  return null;
}
