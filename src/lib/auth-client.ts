import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';

// Use explicit baseURL only when set (e.g. ngrok). Otherwise Better Auth uses
// window.location.origin in the browser, so login works on any dev port (e.g. 3005).
const baseURL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BETTER_AUTH_URL || window.location.origin)
    : process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3005';

export const authClient = createAuthClient({
  baseURL,
  plugins: [jwtClient()],
});

// Export commonly used hooks and methods for convenience
export const { useSession, signIn, signUp, signOut } = authClient;
