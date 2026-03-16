/**
 * Hasura GraphQL WebSocket client for subscriptions.
 * Uses JWT from Better Auth for connectionParams.
 */

import { createClient, type Client } from 'graphql-ws';
import { getHasuraWebSocketUrl } from './hasura-client';

/**
 * Create a graphql-ws client for Hasura subscriptions with the given JWT.
 * Call dispose() when done to close the connection.
 */
export function createHasuraWsClient(token: string | null): Client | null {
  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hasura-ws.ts:createHasuraWsClient',
        message: 'createHasuraWsClient called',
        data: { hasToken: !!token, tokenLength: token?.length ?? 0 },
        timestamp: Date.now(),
        hypothesisId: 'H3',
      }),
    }).catch(() => {});
  }
  // #endregion
  if (!token) return null;
  return createClient({
    url: getHasuraWebSocketUrl(),
    connectionParams: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    lazy: true,
    keepAlive: 10_000,
    retryAttempts: 5,
  });
}
