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
  if (!token) return null;
  return createClient({
    url: getHasuraWebSocketUrl(),
    connectionParams: {
      Authorization: `Bearer ${token}`,
    },
    lazy: true,
    keepAlive: 10_000,
    retryAttempts: 5,
  });
}
