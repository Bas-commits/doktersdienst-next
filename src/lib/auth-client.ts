import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';

// In the browser always use the current origin so sign-in fetches hit the same host
// (avoids "Failed to fetch" when NEXT_PUBLIC_BETTER_AUTH_URL points to ngrok/tunnel that is down).
// Server-side (SSR) falls back to env or localhost.
const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3005';

export const authClient = createAuthClient({
  baseURL,
  plugins: [jwtClient()],
});

// Export commonly used hooks and methods for convenience
export const { useSession, signIn, signUp, signOut } = authClient;
