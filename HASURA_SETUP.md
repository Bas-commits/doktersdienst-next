# Hasura Setup (Direct Frontend + JWT)

The app calls Hasura **directly from the frontend** using a JWT from Better Auth. Hasura verifies the JWT and applies role-based permissions configured in the Hasura console.

## Environment

- **Frontend**: Set `NEXT_PUBLIC_HASURA_GRAPHQL_URL` in `.env.local` if you use a different Hasura endpoint (default: the project Hasura URL).
- **Do not** expose `HASURA_ADMIN_SECRET` to the frontend; use it only in the Hasura console or server-side.

## Hasura Console: JWT Configuration

1. In your Hasura project (Scaleway / Cloud), open **Project Settings** or **Env vars** and enable **JWT** authentication.
2. Set `HASURA_GRAPHQL_JWT_SECRET` (or the equivalent config) to a JSON object that points to your app’s JWKS URL:

   ```json
   {
     "jwk_url": "https://<your-app-domain>/api/auth/jwks",
     "issuer": "https://<your-app-domain>",
     "audience": "https://<your-app-domain>"
   }
   ```

   For local development with **Hasura in the cloud**, use a tunnel (e.g. ngrok) so Hasura can reach your app’s JWKS. Set **all three** to your public URL (no trailing slash):

   - `jwk_url`: `https://<your-ngrok-host>/api/auth/jwks`
   - `issuer` / `audience`: `https://<your-ngrok-host>`

   In your app, set the **same** URL so the JWT issuer matches Hasura (required for JWT verification):

   - In `.env.local`: `BETTER_AUTH_URL=https://<your-ngrok-host>` and `NEXT_PUBLIC_BETTER_AUTH_URL=https://<your-ngrok-host>`
   - Restart the Next.js dev server after changing these.

   For local development with Hasura on the same machine:

   - `jwk_url`: `http://localhost:3005/api/auth/jwks` (or your dev port)
   - `issuer` / `audience`: `http://localhost:3005`

   Better Auth signs JWTs with **EdDSA (Ed25519)**. If your Hasura version does not support EdDSA, check Hasura’s JWT docs for supported algorithms.

3. Ensure requests that do **not** send a valid JWT (or send an invalid/expired one) are rejected: either do not define an “anonymous” role or give it no permissions.

## Hasura Console: Roles and Permissions

1. Create a role (e.g. **user**) in the Hasura **Data** (or **Permissions**) tab.
2. For each table/action that authenticated users may access:
   - **Select**: set row permissions (e.g. `user_id = X-Hasura-User-Id` if your table has a `user_id` column).
   - **Insert/Update/Delete**: configure only if needed, using the same session variables.
3. Session variables available from the JWT:
   - `X-Hasura-User-Id` – from Better Auth `user.id`
   - `X-Hasura-Role` / default role: `user`

References: [Hasura JWT auth](https://hasura.io/docs/latest/auth/authentication/jwt/), [Hasura roles and session variables](https://hasura.io/docs/latest/auth/authorization/roles-variables/).

## Frontend Usage

1. Get a token after sign-in: `const { data } = await authClient.token(); const token = data?.token ?? null`
2. Call Hasura with that token (e.g. using `fetchHasura` from `@/lib/hasura-client`):

   ```ts
   import { authClient } from '@/lib/auth-client';
   import { fetchHasura } from '@/lib/hasura-client';

   const { data: tokenData } = await authClient.token();
   const result = await fetchHasura({
     query: 'query { ... }',
     variables: {},
     token: tokenData?.token ?? null,
   });
   ```

3. On **401** from Hasura, get a new token (`authClient.token()`) and retry (tokens expire in ~15 minutes by default).

## CORS

If the frontend origin (e.g. `http://localhost:3005`) differs from Hasura’s origin, allow the frontend origin in Hasura’s CORS settings so the browser allows the requests.
