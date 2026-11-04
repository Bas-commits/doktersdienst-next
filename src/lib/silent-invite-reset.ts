import { AsyncLocalStorage } from 'node:async_hooks';

/** Set by server-only invite flow so `sendResetPassword` can capture the URL without emailing. */
export type SilentInviteResetStore = { url: string | null };

export const silentInviteResetAls = new AsyncLocalStorage<SilentInviteResetStore>();

export const SILENT_INVITE_RESET_HEADER = 'x-silent-invite-reset';

export function parseTokenFromBetterAuthResetUrl(url: string): string | null {
  const m = url.match(/\/reset-password\/([^/?#]+)/);
  return m?.[1] ?? null;
}
