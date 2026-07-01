import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  getAuthSecret,
  isValidAccountEmail,
  normalizeAccountEmail,
  signEmailChangeToken,
} from '@/lib/account-email-tokens';
import {
  displayNameFromDeelnemer,
  getAccountStatusForUser,
  needsEmailOnboarding,
} from '@/lib/account-status';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEffectivePublicSiteOriginForInvite } from '@/lib/better-auth-url';
import { sendEmailChangeConfirmationEmailViaResend } from '@/lib/resend-email';

const { deelnemers } = schema;

const MAX_LOGIN_EMAIL = 50;

type PostBody = {
  newEmail?: unknown;
};

type Data = { ok: true; message: string } | { error: string };

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
  if (needsEmailOnboarding(row)) {
    return res.status(400).json({
      error: 'Voltooi eerst de e-mailverificatie via het onboarding-scherm.',
    });
  }

  const body = req.body as PostBody;
  const emailRaw = typeof body.newEmail === 'string' ? body.newEmail.trim() : '';
  if (!emailRaw || !isValidAccountEmail(emailRaw)) {
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  }
  if (emailRaw.length > MAX_LOGIN_EMAIL) {
    return res.status(400).json({
      error: `E-mailadres mag maximaal ${MAX_LOGIN_EMAIL} tekens zijn.`,
    });
  }

  const newEmail = normalizeAccountEmail(emailRaw);
  const currentLogin = (row.login || '').trim().toLowerCase();
  if (newEmail === currentLogin) {
    return res.status(400).json({ error: 'Dit is al uw huidige login-e-mailadres.' });
  }

  const [dupe] = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(and(eq(deelnemers.login, newEmail), ne(deelnemers.id, user.id)))
    .limit(1);
  if (dupe) {
    return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik als loginnaam.' });
  }

  if (!getAuthSecret()) {
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt voor e-mailverificatie. Neem contact op met de beheerder.',
    });
  }

  const siteOrigin = getEffectivePublicSiteOriginForInvite(req);
  if (!siteOrigin) {
    return res.status(400).json({
      error: 'Kon geen geldige site-URL bepalen. Vernieuw de pagina en probeer opnieuw.',
    });
  }

  let confirmUrl: string;
  try {
    const token = await signEmailChangeToken(user.id, newEmail);
    confirmUrl = `${siteOrigin.replace(/\/+$/, '')}/api/account/bevestig-email-wijziging?token=${encodeURIComponent(token)}`;
  } catch (err) {
    console.error('account/email-wijziging-aanvragen: sign JWT failed', err);
    return res.status(500).json({ error: 'Kon bevestigingslink niet aanmaken.' });
  }

  try {
    await sendEmailChangeConfirmationEmailViaResend({
      to: newEmail,
      url: confirmUrl,
      userName: displayNameFromDeelnemer(row),
    });
  } catch (err) {
    console.error('account/email-wijziging-aanvragen: send email failed', err);
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: `De bevestigingsmail kon niet worden verstuurd: ${detail}`,
    });
  }

  return res.status(200).json({
    ok: true,
    message: `Bevestigingsmail verstuurd naar ${newEmail}. Uw login wijzigt pas na bevestiging.`,
  });
}
