import { APIError } from '@better-auth/core/error';

export const STRONG_PASSWORD_MIN_LENGTH = 12;

export type StrongPasswordRuleId =
  | 'length'
  | 'upper'
  | 'lower'
  | 'digit'
  | 'special';

export type StrongPasswordRule = {
  id: StrongPasswordRuleId;
  label: string;
  ok: (password: string) => boolean;
};

export const strongPasswordRules: StrongPasswordRule[] = [
  {
    id: 'length',
    label: `Minimaal ${STRONG_PASSWORD_MIN_LENGTH} tekens`,
    ok: (p) => p.length >= STRONG_PASSWORD_MIN_LENGTH,
  },
  {
    id: 'upper',
    label: 'Minimaal één hoofdletter (A–Z)',
    ok: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lower',
    label: 'Minimaal één kleine letter (a–z)',
    ok: (p) => /[a-z]/.test(p),
  },
  {
    id: 'digit',
    label: 'Minimaal één cijfer',
    ok: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'Minimaal één speciaal teken (bijv. !@#$%)',
    ok: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export function isStrongPassword(password: string): boolean {
  return strongPasswordRules.every((r) => r.ok(password));
}

export function getStrongPasswordFailures(password: string): StrongPasswordRule[] {
  return strongPasswordRules.filter((r) => !r.ok(password));
}

/**
 * Throws Better Auth APIError when password does not meet policy (Dutch message).
 */
export function assertStrongPasswordOrThrow(password: unknown): asserts password is string {
  if (typeof password !== 'string') {
    throw APIError.from('BAD_REQUEST', {
      message: 'Wachtwoord ontbreekt of is ongeldig.',
      code: 'WEAK_PASSWORD',
    });
  }
  const failures = getStrongPasswordFailures(password);
  if (failures.length === 0) return;
  const hint = failures.map((f) => f.label).join('; ');
  throw APIError.from('BAD_REQUEST', {
    message: `Kies een sterker wachtwoord. Vereist: ${hint}.`,
    code: 'WEAK_PASSWORD',
  });
}
