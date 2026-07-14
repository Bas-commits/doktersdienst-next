import { useEffect } from 'react';
import { useRouter } from 'next/router';

/** Keeps legacy-style `/praktijkplanner` links stable while opening the primary screen. */
export default function PraktijkplannerIndexPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace('/praktijkplanner/activiteiten');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6" role="status">
      <p className="text-muted-foreground">Praktijkplanner openen…</p>
    </div>
  );
}
