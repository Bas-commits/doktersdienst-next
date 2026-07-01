/** Set on email-instellen submit; cleared after strong password setup via verify flow. */
export const PENDING_PASSWORD_SETUP_MARKER = 'ba-pending-setup:v1';

/** Marker in `deelnemers.password` after completing Better Auth strong-password setup. */
export const PASSWORD_UPGRADED_MARKER = 'ba-upgraded:v1';

export function isPasswordUpgraded(passwordField: string | null | undefined): boolean {
  return passwordField === PASSWORD_UPGRADED_MARKER;
}

export function isPendingPasswordSetup(passwordField: string | null | undefined): boolean {
  return passwordField === PENDING_PASSWORD_SETUP_MARKER;
}

export function isPasswordSetupMarker(passwordField: string | null | undefined): boolean {
  return isPasswordUpgraded(passwordField) || isPendingPasswordSetup(passwordField);
}
