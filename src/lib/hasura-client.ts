/**
 * Hasura GraphQL client for direct frontend calls.
 * Uses JWT from Better Auth (authClient.token()) in Authorization header.
 * Set NEXT_PUBLIC_HASURA_GRAPHQL_URL in .env.local.
 */

const HASURA_GRAPHQL_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ||
  'https://hasura769e6a73-hasura-dd.functions.fnc.nl-ams.scw.cloud/v1/graphql';

export function getHasuraGraphqlUrl(): string {
  return HASURA_GRAPHQL_URL;
}

export type HasuraFetchOptions = {
  query: string;
  variables?: Record<string, unknown>;
  token: string | null;
};

export type HasuraFetchResult<T = unknown> =
  | { data: T; errors?: never }
  | { data?: never; errors: Array<{ message: string }> };

/**
 * Run a GraphQL operation against Hasura with the given JWT.
 * Get the token via: const { data } = await authClient.token(); token = data?.token ?? null
 * On 401 from Hasura, refresh the token (authClient.token() again) and retry.
 */
export async function fetchHasura<T = unknown>({
  query,
  variables,
  token,
}: HasuraFetchOptions): Promise<HasuraFetchResult<T>> {
  if (!token) {
    return { errors: [{ message: 'Not authenticated' }] };
  }

  const res = await fetch(HASURA_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    credentials: 'omit',
  });

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (!res.ok) {
    const rawErrors = json.errors ?? [{ message: res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}` }];
    const hasuraConfigError = rawErrors.some((e) =>
      /x-hasura-admin-secret|x-hasura-access-key|required.*not found/i.test(e.message)
    );
    if (hasuraConfigError) {
      return {
        errors: [
          {
            message:
              'De GraphQL-api staat alleen admin-toegang toe. Configureer JWT-authenticatie in Hasura (HASURA_GRAPHQL_JWT_SECRET) zodat ingelogde gebruikers met een token kunnen werken.',
          },
        ],
      };
    }
    return { errors: rawErrors };
  }

  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message);
    const hasuraConfigError = messages.some(
      (m) =>
        /x-hasura-admin-secret|x-hasura-access-key|required.*not found/i.test(m)
    );
    if (hasuraConfigError) {
      return {
        errors: [
          {
            message:
              'De GraphQL-api staat alleen admin-toegang toe. Configureer JWT-authenticatie in Hasura (HASURA_GRAPHQL_JWT_SECRET) zodat ingelogde gebruikers met een token kunnen werken.',
          },
        ],
      };
    }
    return { errors: json.errors };
  }

  return { data: json.data as T };
}
