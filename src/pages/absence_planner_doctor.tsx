import type { GetServerSideProps } from 'next';

/**
 * Keeps existing doctor bookmarks working after the Praktijkplanner migration.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/praktijkplanner/afwezigheidsplanner-dokter',
    permanent: false,
  },
});

export default function AbsencePlannerDoctorRedirect() {
  return null;
}
