'use client';

import { gql } from '@apollo/client';
import { useSubscription } from '@apollo/client/react';
import { useMemo } from 'react';

const QUERY_DIENSTEN = gql`
  subscription queryDiensten {
    diensten(
      where: {
        van: { _gte: "1736899200" }
        tot: { _lte: "1741996800" }
        idwaarneemgroep: { _in: [11, 45, 46] }
        type: { _in: [3, 2, 9, 10, 5001] }
        diensten_deelnemers: { id: { _eq: 755 } }
      }
    ) {
      id
      van
      tot
      type
      idwaarneemgroep
      diensten_deelnemers {
        voornaam
        achternaam
        color
      }
    }
  }
`;

export default function TestPage() {
  const { data, loading, error } = useSubscription(QUERY_DIENSTEN);

  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'test.tsx:TestPage',
        message: 'useSubscription state',
        data: { loading, hasData: !!data, errorMessage: error?.message ?? null, dienstenCount: data?.diensten?.length ?? 0 },
        timestamp: Date.now(),
        hypothesisId: 'H4',
      }),
    }).catch(() => {});
  }
  // #endregion

  const rawJson = useMemo(() => {
    return JSON.stringify({ data, loading, error: error?.message ?? null }, null, 2);
  }, [data, loading, error]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Hasura subscription test: diensten</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Raw subscription result from Apollo Client → Hasura (queryDiensten). Updates in real time.
      </p>

      {loading && !data && (
        <p className="text-amber-600 dark:text-amber-400 mb-4">Connecting / waiting for first payload…</p>
      )}
      {error && (
        <div className="mb-4 space-y-2">
          <pre className="p-4 rounded bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 overflow-x-auto text-sm">
            {error.message}
          </pre>
          {(error.message.includes('4403') || error.message.includes('Forbidden')) && (
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> 4403 Forbidden usually means Hasura rejected the WebSocket connection. Check (1){' '}
              <strong>CORS</strong>: add your app origin (e.g. this site’s URL) to Hasura’s{' '}
              <code className="rounded bg-muted px-1">HASURA_GRAPHQL_CORS_DOMAIN</code>. (2){' '}
              <strong>JWT</strong>: ensure the token is valid and Hasura’s JWT secret matches.
            </p>
          )}
        </div>
      )}

      <pre className="p-4 rounded bg-muted overflow-x-auto text-sm whitespace-pre-wrap wrap-break-word">
        {rawJson}
      </pre>
    </div>
  );
}
