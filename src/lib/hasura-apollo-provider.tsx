'use client';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { ApolloLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { OperationTypeNode } from 'graphql';
import { useMemo, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { getHasuraGraphqlUrl } from '@/lib/hasura-client';
import { createHasuraWsClient } from '@/lib/hasura-ws';

function buildHasuraApolloClient(token: string | null): ApolloClient<unknown> {
  // #region agent log
  const hasToken = !!token;
  fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hasura-apollo-provider.tsx:buildHasuraApolloClient',
      message: 'Building Apollo client',
      data: { hasToken, tokenLength: token?.length ?? 0 },
      timestamp: Date.now(),
      hypothesisId: 'H1',
    }),
  }).catch(() => {});
  // #endregion

  const httpLink = new HttpLink({
    uri: getHasuraGraphqlUrl(),
  });

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));

  const wsClient = token ? createHasuraWsClient(token) : null;
  const wsLink = wsClient ? new GraphQLWsLink(wsClient) : null;

  const link = wsLink
    ? split(
        ({ query }) => {
          const def = query.definitions[0];
          return def?.kind === 'OperationDefinition' && def.operation === OperationTypeNode.SUBSCRIPTION;
        },
        wsLink,
        ApolloLink.from([authLink, httpLink])
      )
    : ApolloLink.from([authLink, httpLink]);

  // #region agent log
  fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hasura-apollo-provider.tsx:buildHasuraApolloClient',
      message: 'Apollo client link type',
      data: { hasWsLink: !!wsLink, linkType: wsLink ? 'split' : 'httpOnly' },
      timestamp: Date.now(),
      hypothesisId: 'H2',
    }),
  }).catch(() => {});
  // #endregion

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });
}

export function HasuraApolloProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenRequestDone, setTokenRequestDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authClient.token().then(({ data }) => {
      const newToken = data?.token ?? null;
      // #region agent log
      fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'hasura-apollo-provider.tsx:useEffect',
          message: 'Token from authClient',
          data: { hasToken: !!newToken, tokenLength: newToken?.length ?? 0, cancelled },
          timestamp: Date.now(),
          hypothesisId: 'H1',
        }),
      }).catch(() => {});
      // #endregion
      if (!cancelled) {
        setToken(newToken);
        setTokenRequestDone(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const client = useMemo(() => buildHasuraApolloClient(token), [token]);

  // Don't render ApolloProvider (and thus subscription) until we've run the token request once.
  // Otherwise the client is built with token=null (no WS link) and the subscription hangs over HTTP.
  if (!tokenRequestDone) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4" role="status" aria-label="Auth laden">
        <p className="text-muted-foreground">Authentication laden…</p>
      </div>
    );
  }

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
