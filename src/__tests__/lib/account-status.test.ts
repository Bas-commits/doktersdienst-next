import { describe, expect, it } from 'vitest';
import {
  isPasswordUpgraded,
  isPendingPasswordSetup,
  PENDING_PASSWORD_SETUP_MARKER,
} from '@/lib/account-password-upgrade';
import { needsEmailOnboarding } from '@/lib/account-status';

describe('needsEmailOnboarding', () => {
  it('returns true when email is not verified', () => {
    expect(needsEmailOnboarding({ emailVerified: false })).toBe(true);
    expect(needsEmailOnboarding({ emailVerified: null })).toBe(true);
  });

  it('returns false when email is verified', () => {
    expect(needsEmailOnboarding({ emailVerified: true })).toBe(false);
  });
});

describe('password setup markers', () => {
  it('recognises upgraded and pending markers', () => {
    expect(isPasswordUpgraded('ba-upgraded:v1')).toBe(true);
    expect(isPendingPasswordSetup(PENDING_PASSWORD_SETUP_MARKER)).toBe(true);
    expect(isPasswordUpgraded(PENDING_PASSWORD_SETUP_MARKER)).toBe(false);
    expect(isPendingPasswordSetup('ba-upgraded:v1')).toBe(false);
  });
});
