import type { NextApiRequest, NextApiResponse } from 'next';
import { signJWT } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import { resolveInviteEmailAuthApiBase } from '@/lib/better-auth-url';
import { sendVerificationEmailViaResendWithProof } from '@/lib/resend-email';

const { deelnemers, waarneemgroepdeelnemers } = schema;

const EMAIL_VERIFICATION_TTL_SEC = 3600;

type PostBody = {
  iddeelnemer?: unknown;
  idwaarneemgroep?: unknown;
  inviteInitiatedOrigin?: unknown;
};

type Data =
  | { ok: true; emailVerified: boolean; message: string }
  | { error: string };

function getAuthSecret(): string | null {
  const s = process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  return s || null;
}

function displayName(row: {
  name: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
}): string | null {
  return row.name || [row.voornaam, row.voorletterstussenvoegsel, row.achternaam].filter(Boolean).join(' ') || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as PostBody;
  const iddeelnemer = typeof body.iddeelnemer === 'number' ? body.iddeelnemer : Number(body.iddeelnemer);
  const idwaarneemgroep =
    typeof body.idwaarneemgroep === 'number' ? body.idwaarneemgroep : Number(body.idwaarneemgroep);

  if (!Number.isFinite(iddeelnemer) || !Number.isFinite(idwaarneemgroep)) {
    return res.status(400).json({ error: 'iddeelnemer en idwaarneemgroep zijn verplicht.' });
  }

  if (!(await hasGroupManagementAccess(user, idwaarneemgroep))) {
    return res.status(403).json({ error: 'Geen beheer rechten voor de gekozen waarneemgroep.' });
  }

  const [membership] = await db
    .select({ id: waarneemgroepdeelnemers.id })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer),
        eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
        eq(waarneemgroepdeelnemers.aangemeld, true)
      )
    )
    .limit(1);

  if (!membership) {
    return res.status(404).json({ error: 'Deelnemer niet gevonden in deze waarneemgroep.' });
  }

  const [target] = await db
    .select({
      id: deelnemers.id,
      login: deelnemers.login,
      email: deelnemers.email,
      name: deelnemers.name,
      voornaam: deelnemers.voornaam,
      voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
      achternaam: deelnemers.achternaam,
      emailVerified: deelnemers.emailVerified,
    })
    .from(deelnemers)
    .where(eq(deelnemers.id, iddeelnemer))
    .limit(1);

  if (!target || target.id == null) {
    return res.status(404).json({ error: 'Deelnemer niet gevonden.' });
  }

  if (target.emailVerified === true) {
    return res.status(200).json({
      ok: true,
      emailVerified: true,
      message: 'Dit e-mailadres is al geverifieerd.',
    });
  }

  const email = (target.login || target.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Deze deelnemer heeft geen geldig e-mailadres.' });
  }

  const authSecret = getAuthSecret();
  if (!authSecret) {
    console.error('deelnemers/verificatie-opnieuw: BETTER_AUTH_SECRET / AUTH_SECRET ontbreekt');
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt voor e-mailverificatie. Neem contact op met de beheerder.',
    });
  }

  const inviteOrigin =
    typeof body.inviteInitiatedOrigin === 'string' ? body.inviteInitiatedOrigin.trim() || undefined : undefined;
  const inviteBaseResolved = resolveInviteEmailAuthApiBase(req, inviteOrigin);
  if (!inviteBaseResolved.ok) {
    return res.status(400).json({ error: inviteBaseResolved.error });
  }

  let verificationUrl: string;
  try {
    const token = await signJWT({ email }, authSecret, EMAIL_VERIFICATION_TTL_SEC);
    verificationUrl = `${inviteBaseResolved.authApiBase}/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/api/invite/na-verificatie')}`;
  } catch (err) {
    console.error('deelnemers/verificatie-opnieuw: sign verification JWT failed', err);
    return res.status(500).json({
      error: 'Kon verificatielink niet aanmaken. Probeer het later opnieuw of neem contact op met de beheerder.',
    });
  }

  try {
    await sendVerificationEmailViaResendWithProof({
      to: email,
      url: verificationUrl,
      userName: displayName(target),
    });
  } catch (err) {
    console.error('sendVerificationEmail voor bestaande deelnemer', err);
    const detail = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: `De verificatiemail kon niet worden verstuurd: ${detail}`,
    });
  }

  return res.status(200).json({
    ok: true,
    emailVerified: false,
    message: 'Verificatiemail opnieuw verstuurd.',
  });
}
