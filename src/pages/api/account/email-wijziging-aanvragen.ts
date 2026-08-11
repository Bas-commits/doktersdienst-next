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
import { BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST } from '@/lib/beheerder-contact';
import { getEffectivePublicSiteOriginForInvite } from '@/lib/better-auth-url';
import {
  sendEmailChangeConfirmationEmailViaResend,
  sendEmailChangeNoticeEmailViaResend,
} from '@/lib/resend-email';

const { deelnemers } = schema;

const MAX_LOGIN_EMAIL = 50;

type PostBody = {
  newEmail?: unknown;
  /** Alleen de beheerder mag dit meesturen: het account dat gewijzigd wordt. */
  deelnemerId?: unknown;
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

  // Elke adreswijziging loopt hierlangs, ook die van de beheerder voor een
  // ander. Anders zou hij een login kunnen zetten op een adres waarvan niemand
  // heeft aangetoond dat de deelnemer erbij kan.
  const body = req.body as PostBody;
  const gevraagdeId = Number(body.deelnemerId);
  const targetId =
    Number.isInteger(gevraagdeId) && gevraagdeId > 0 ? gevraagdeId : user.id;
  const isDelegated = targetId !== user.id;
  if (isDelegated && !user.isAdmin) {
    return res.status(403).json({ error: BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST });
  }

  const row = await getAccountStatusForUser(targetId);
  if (!row) {
    return res.status(404).json({ error: 'Deelnemer niet gevonden' });
  }
  // Je eigen adres wijzigen kan pas als je het huidige hebt bevestigd; anders
  // hoor je in het onboarding-scherm. Die eis geldt niet voor de beheerder: een
  // account dat daar juist op vastloopt is precies wat hij komt losmaken.
  if (!isDelegated && needsEmailOnboarding(row)) {
    return res.status(400).json({
      error: 'Voltooi eerst de e-mailverificatie via het onboarding-scherm.',
    });
  }

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
    .where(and(eq(deelnemers.login, newEmail), ne(deelnemers.id, targetId)))
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
    const token = await signEmailChangeToken(targetId, newEmail);
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

  // Pas melden nadat de bevestiging eruit is. Andersom zou het oude adres een
  // wijziging aangekondigd krijgen die daarna alsnog op een 502 strandt.
  // Mislukt de melding zelf, dan gaat de aanvraag door: de bevestigingsmail is
  // wat de wijziging tegenhoudt, niet deze.
  if (currentLogin.includes('@')) {
    try {
      await sendEmailChangeNoticeEmailViaResend({
        to: currentLogin,
        newEmail,
        userName: displayNameFromDeelnemer(row),
      });
    } catch (err) {
      console.error('account/email-wijziging-aanvragen: notice to old address failed', err);
    }
  }

  return res.status(200).json({
    ok: true,
    message: `Bevestigingsmail verstuurd naar ${newEmail}. Uw login wijzigt pas na bevestiging.`,
  });
}
