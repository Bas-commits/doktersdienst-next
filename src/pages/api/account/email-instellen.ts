import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  getAuthSecret,
  isValidAccountEmail,
  normalizeAccountEmail,
  signOnboardingVerificationToken,
} from '@/lib/account-email-tokens';
import {
  isPasswordUpgraded,
  PENDING_PASSWORD_SETUP_MARKER,
} from '@/lib/account-password-upgrade';
import {
  displayNameFromDeelnemer,
  getAccountStatusForUser,
  needsEmailOnboarding,
} from '@/lib/account-status';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { resolveInviteEmailAuthApiBase } from '@/lib/better-auth-url';
import { sendVerificationEmailViaResendWithProof } from '@/lib/resend-email';

const { deelnemers } = schema;

const MAX_LOGIN_EMAIL = 50;

type PostBody = {
  email?: unknown;
  inviteInitiatedOrigin?: unknown;
};

type Data =
  | { ok: true; signedOut: true; message: string }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const row = await getAccountStatusForUser(user.id);
  if (!row) {
    return res.status(404).json({ error: 'Deelnemer niet gevonden' });
  }
  if (!needsEmailOnboarding(row)) {
    return res.status(400).json({ error: 'Uw e-mailadres is al geverifieerd.' });
  }

  const body = req.body as PostBody;
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!emailRaw || !isValidAccountEmail(emailRaw)) {
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  }
  if (emailRaw.length > MAX_LOGIN_EMAIL) {
    return res.status(400).json({
      error: `E-mailadres mag maximaal ${MAX_LOGIN_EMAIL} tekens zijn.`,
    });
  }

  const newEmail = normalizeAccountEmail(emailRaw);

  const [dupe] = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(and(eq(deelnemers.login, newEmail), ne(deelnemers.id, user.id)))
    .limit(1);
  if (dupe) {
    return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik als loginnaam.' });
  }

  const authSecret = getAuthSecret();
  if (!authSecret) {
    console.error('account/email-instellen: BETTER_AUTH_SECRET / AUTH_SECRET ontbreekt');
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt voor e-mailverificatie. Neem contact op met de beheerder.',
    });
  }

  const inviteOrigin =
    typeof body.inviteInitiatedOrigin === 'string'
      ? body.inviteInitiatedOrigin.trim() || undefined
      : undefined;
  const inviteBaseResolved = resolveInviteEmailAuthApiBase(req, inviteOrigin);
  if (!inviteBaseResolved.ok) {
    return res.status(400).json({ error: inviteBaseResolved.error });
  }

  await db
    .update(deelnemers)
    .set({
      login: newEmail,
      email: newEmail,
      huisemail: newEmail,
      emailVerified: false,
      password: isPasswordUpgraded(row.password)
        ? row.password
        : PENDING_PASSWORD_SETUP_MARKER,
    })
    .where(eq(deelnemers.id, user.id));

  let verificationUrl: string;
  try {
    const token = await signOnboardingVerificationToken(newEmail);
    verificationUrl = `${inviteBaseResolved.authApiBase}/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/api/invite/na-verificatie')}`;
  } catch (err) {
    console.error('account/email-instellen: sign verification JWT failed', err);
    return res.status(500).json({
      error: 'Kon verificatielink niet aanmaken. Probeer het later opnieuw.',
    });
  }

  try {
    await sendVerificationEmailViaResendWithProof({
      to: newEmail,
      url: verificationUrl,
      userName: displayNameFromDeelnemer(row),
    });
  } catch (err) {
    console.error('account/email-instellen: send verification email failed', err);
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: `De verificatiemail kon niet worden verstuurd: ${detail}`,
    });
  }

  return res.status(200).json({
    ok: true,
    signedOut: true,
    message:
      'Verificatiemail verstuurd. Ga verder met het instellen van uw account via de link in de e-mail.',
  });
}
