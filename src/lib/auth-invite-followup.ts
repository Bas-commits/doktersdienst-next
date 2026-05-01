import { auth } from '@/lib/auth';
import { getBetterAuthApiBase } from '@/lib/better-auth-url';
import { syntheticSignUpTrustHeaders } from '@/lib/deelnemer-nieuw';
import {
  parseTokenFromBetterAuthResetUrl,
  silentInviteResetAls,
  SILENT_INVITE_RESET_HEADER,
} from '@/lib/silent-invite-reset';

/**
 * Mint a reset-password token via Better Auth without sending e-mail (invite completion).
 * Must run inside the same async context as the matching `sendResetPassword` handler.
 */
export async function requestPasswordResetSilently(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const siteOrigin = new URL(getBetterAuthApiBase()).origin;

  return silentInviteResetAls.run({ url: null }, async () => {
    const headers = syntheticSignUpTrustHeaders();
    headers.set(SILENT_INVITE_RESET_HEADER, '1');

    await auth.api.requestPasswordReset({
      body: {
        email: normalized,
        redirectTo: `${siteOrigin}/reset-password`,
      },
      headers,
    });

    const url = silentInviteResetAls.getStore()?.url ?? null;
    if (!url) {
      throw new Error('silent password reset: URL not captured');
    }
    const token = parseTokenFromBetterAuthResetUrl(url);
    if (!token) {
      throw new Error('silent password reset: could not parse token from URL');
    }
    return token;
  });
}
