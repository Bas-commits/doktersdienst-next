'use client';

import Head from 'next/head';
import { useState } from 'react';

type Waarneemgroep = {
  id: number | null;
  naam: string | null;
  [key: string]: unknown;
};

export default function WaarneemgroepenPage() {
  const [data, setData] = useState<{ waarneemgroepen: Waarneemgroep[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/waarneemgroepen', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Waarneemgroepen | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Waarneemgroepen</h1>
        <p className="mt-1 text-muted-foreground">
          Haal waarneemgroepen op waar je bij aangemeld bent of in de gekozen regio.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Laden…' : 'Waarneemgroepen ophalen'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-6 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="text-lg font-medium">
              Resultaat ({data.waarneemgroepen.length} groep{data.waarneemgroepen.length !== 1 ? 'pen' : ''})
            </h2>
            {data.waarneemgroepen.length === 0 ? (
              <p className="mt-2 text-muted-foreground">Geen waarneemgroepen gevonden.</p>
            ) : (
              <ul className="mt-3 list-inside list-disc space-y-1">
                {data.waarneemgroepen.map((wg) => (
                  <li key={wg.id ?? wg.naam ?? Math.random()}>
                    {wg.naam ?? '(geen naam)'} {wg.id != null && `(id: ${wg.id})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
