'use client';

import Head from 'next/head';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { waarneemgroepRows } from '@/components/CalandarGrid/CalendarGrid.fixtures';


export default function RoosterInzienPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  return (
    <>
      <Head>
        <title>Rooster inzien | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 id="welcome-heading" className="text-2xl font-semibold tracking-tight">
                Welkom, {name}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Je bent ingelogd bij Doktersdienst. Gebruik het menu om naar waarneemgroepen of andere onderdelen te gaan.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rooster inzien</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarGridWithNavState
              rows={waarneemgroepRows}
              initialViewMonth={2}
              initialViewYear={2025}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}