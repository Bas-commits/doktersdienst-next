import type { NextApiRequest, NextApiResponse } from 'next';
import { signJWT } from 'better-auth/crypto';
import { eq, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import {
  listGroepChoicesForNewDeelnemer,
  resolveDeelnemerCreatePermission,
} from '@/lib/deelnemer-nieuw';
import { resolveInviteEmailAuthApiBase } from '@/lib/better-auth-url';
import { sendVerificationEmailViaResendWithProof } from '@/lib/resend-email';

const { deelnemers, waarneemgroepdeelnemers } = schema;

const MAX_LOGIN_EMAIL = 50;
const MAX_NAME_FIELD = 50;
const EMAIL_VERIFICATION_TTL_SEC = 3600;

function getAuthSecret(): string | null {
  const s = process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  return s || null;
}

type PostBody = {
  email?: unknown;
  voornaam?: unknown;
  voorletterstussenvoegsel?: unknown;
  achternaam?: unknown;
  initialen?: unknown;
  huisadrtelnr?: unknown;
  idgroep?: unknown;
  idwaarneemgroep?: unknown;
  /** Browser `window.location.origin`; must agree with server's Host/Forwarded/Origin (`Origin` matches on POST). */
  inviteInitiatedOrigin?: unknown;
};

/** Normalize id from Postgres/Drizzle (number, bigint, numeric string). */
function coerceInsertedDeelnemerId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type PostDeelnemerNieuwOk = {
  ok: true;
  iddeelnemer: number;
  message: string;
};
export type PostDeelnemerNieuwErr = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostDeelnemerNieuwOk | PostDeelnemerNieuwErr>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const perm = await resolveDeelnemerCreatePermission(user);
  if (!perm.ok) {
    return res.status(403).json({ error: perm.forbiddenReason });
  }

  const b = req.body as PostBody;
  const idwaarneemgroep =
    typeof b.idwaarneemgroep === 'number' ? b.idwaarneemgroep : Number(b.idwaarneemgroep);
  const idgroep = typeof b.idgroep === 'number' ? b.idgroep : Number(b.idgroep);
  if (!Number.isFinite(idwaarneemgroep) || !Number.isFinite(idgroep)) {
    return res
      .status(400)
      .json({ error: 'idwaarneemgroep en idgroep zijn verplicht en moeten een getal zijn.' });
  }

  if (!(await hasGroupManagementAccess(user, idwaarneemgroep))) {
    return res.status(403).json({ error: 'Geen beheer rechten voor de gekozen waarneemgroep.' });
  }

  const groepChoices = await listGroepChoicesForNewDeelnemer();
  const groepIds = new Set(groepChoices.map((g) => g.id));
  if (!groepIds.has(idgroep)) {
    return res.status(400).json({ error: 'Geen geldige rol (idgroep) voor uw account gekozen.' });
  }

  const emailRaw = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';

  if (!emailRaw.includes('@')) {
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  }
  if (emailRaw.length > MAX_LOGIN_EMAIL) {
    return res.status(400).json({
      error: `E-mailadres mag maximaal ${MAX_LOGIN_EMAIL} tekens zijn (legacy database).`,
    });
  }

  const voornaam = clip((typeof b.voornaam === 'string' ? b.voornaam : '').trim(), MAX_NAME_FIELD);
  const tussen = clip(
    (typeof b.voorletterstussenvoegsel === 'string' ? b.voorletterstussenvoegsel : '').trim(),
    MAX_NAME_FIELD
  );
  const achternaam = clip((typeof b.achternaam === 'string' ? b.achternaam : '').trim(), MAX_NAME_FIELD);
  const initialen = clip((typeof b.initialen === 'string' ? b.initialen : '').trim(), MAX_NAME_FIELD);
  const mobil = clip((typeof b.huisadrtelnr === 'string' ? b.huisadrtelnr : '').trim(), MAX_NAME_FIELD);

  if (!voornaam || !achternaam || !initialen) {
    return res.status(400).json({ error: 'Voornaam, achternaam en initialen zijn verplicht.' });
  }

  const displayName = clip(
    [voornaam, tussen, achternaam].filter(Boolean).join(' '),
    MAX_NAME_FIELD
  );

  const [dupLogin] = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(or(eq(deelnemers.login, emailRaw), eq(deelnemers.email, emailRaw)))
    .limit(1);
  if (dupLogin?.id != null) {
    return res.status(422).json({
      error: 'Er bestaat al een gebruiker met dit e‑mailadres.',
    });
  }

  const authSecret = getAuthSecret();
  if (!authSecret) {
    console.error('deelnemer-nieuw: BETTER_AUTH_SECRET / AUTH_SECRET ontbreekt');
    return res.status(500).json({
      error: 'Serverconfiguratie ontbreekt voor e-mailverificatie. Neem contact op met de beheerder.',
    });
  }

  const inviteOrigin =
    typeof b.inviteInitiatedOrigin === 'string' ? b.inviteInitiatedOrigin.trim() || undefined : undefined;
  const inviteBaseResolved = resolveInviteEmailAuthApiBase(req, inviteOrigin);
  if (!inviteBaseResolved.ok) {
    return res.status(400).json({ error: inviteBaseResolved.error });
  }
  const authApiBase = inviteBaseResolved.authApiBase;

  let verificationUrl: string;
  try {
    const token = await signJWT({ email: emailRaw }, authSecret, EMAIL_VERIFICATION_TTL_SEC);
    verificationUrl = `${authApiBase}/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent('/api/invite/na-verificatie')}`;
  } catch (err) {
    console.error('deelnemer-nieuw: sign verification JWT failed', err);
    return res.status(500).json({
      error: 'Kon uitnodigingslink niet aanmaken. Probeer het later opnieuw of neem contact op met de beheerder.',
    });
  }

  try {
    await sendVerificationEmailViaResendWithProof({
      to: emailRaw,
      url: verificationUrl,
      userName: displayName,
    });
  } catch (e) {
    console.error('sendVerificationEmail (strict Resend) voor nieuwe deelnemer', e);
    const detail = e instanceof Error ? e.message : String(e);
    return res.status(502).json({
      error: `De uitnodigingsmail kon niet worden verstuurd: ${detail}`,
    });
  }

  let newUserId: number;

  try {
    newUserId = await db.transaction(async (tx) => {
      await tx.execute(sql`lock table ${deelnemers} in exclusive mode`);
      const [nextIdRow] = await tx
        .select({ id: sql<number>`coalesce(max(${deelnemers.id}), 0) + 1` })
        .from(deelnemers)
        .limit(1);
      const allocatedId = coerceInsertedDeelnemerId(nextIdRow?.id);
      if (allocatedId == null) {
        throw new Error('De database kon geen volgend deelnemer-id bepalen.');
      }

      const insertedRows = await tx
        .insert(deelnemers)
        .values({
          id: allocatedId,
          voornaam,
          voorletterstussenvoegsel: tussen || null,
          achternaam,
          initialen,
          name: displayName,
          login: emailRaw,
          email: emailRaw,
          huisemail: emailRaw,
          huisadrtelnr: mobil || null,
          idgroep,
          idwaarneemgroep,
          abonnementdd: true,
          echtedeelnemer: true,
          afgemeld: false,
          color: '#9ca3af',
          emailVerified: false,
          role: 'user',
        })
        .returning({ id: deelnemers.id });

      let id = coerceInsertedDeelnemerId(insertedRows[0]?.id);
      if (id == null) {
        const [byLogin] = await tx
          .select({ id: deelnemers.id })
          .from(deelnemers)
          .where(eq(deelnemers.login, emailRaw))
          .limit(1);
        id = coerceInsertedDeelnemerId(byLogin?.id);
      }

      if (id == null || !Number.isFinite(id)) {
        throw new Error(
          'De database kon geen deelnemer-id genereren voor insert. Staat kolom id op DEFAULT (SERIAL/identity)?'
        );
      }
      await tx.insert(waarneemgroepdeelnemers).values({
        iddeelnemer: id,
        idwaarneemgroep,
        idgroep,
        aangemeld: true,
      });
      return id;
    });
  } catch (err) {
    console.error('deelnemer-nieuw insert-transaction error', err);
    const code = typeof err === 'object' && err !== null ? (err as { code?: string }).code : '';
    const cause =
      err && typeof err === 'object' && 'cause' in err && err.cause && typeof err.cause === 'object'
        ? (err.cause as { code?: string }).code
        : undefined;
    const pgCode = code || cause || '';
    if (code === '23505' || pgCode === '23505') {
      return res.status(422).json({ error: 'Er bestaat al een gebruiker met dit e‑mailadres.' });
    }
    const msg =
      err instanceof Error
        ? err.message
        : 'Aanmaken deelnemer mislukt.';
    return res.status(500).json({ error: msg });
  }

  return res.status(200).json({
    ok: true,
    iddeelnemer: newUserId,
    message:
      'Deelnemer toegevoegd. Er is een e‑mail gestuurd met een link om het adres te bevestigen; daarna wordt direct gevraagd een sterk wachtwoord te kiezen.',
  });
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}
