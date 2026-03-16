import type { GetServerSideProps } from 'next';
import { auth } from '@/lib/auth';

function toHeaders(
  incoming: Record<string, string | string[] | undefined>
): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth.api.getSession({
    headers: toHeaders(context.req.headers),
  });
  return {
    redirect: {
      destination: session?.user ? '/rooster-inzien' : '/login',
      permanent: false,
    },
  };
};

export default function Home() {
  return null;
}
