import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import {
  renderMagicLinkBodies,
  renderPasswordResetBodies,
  renderVerificationBodies,
} from '@/lib/render-auth-email';

const log = logger.child({ module: 'resend-email' });

let resendClient: Resend | null | undefined;

function getResend(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const key = process.env.RESEND_API_KEY;
  resendClient = key ? new Resend(key) : null;
  return resendClient;
}

function getFromAddress(): string | null {
  const from = process.env.RESEND_FROM?.trim();
  return from || null;
}

async function sendRenderedEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  devLogPayload: Record<string, unknown>;
  warnMessage: string;
  errorLabel: string;
}): Promise<void> {
  const resend = getResend();
  const from = getFromAddress();

  if (!resend || !from) {
    log.warn(
      {
        ...params.devLogPayload,
        hasKey: !!resend,
        hasFrom: !!from,
      },
      params.warnMessage
    );
    console.log('[auth email]', params.devLogPayload);
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  if (error) {
    log.error({ err: error, to: params.to }, params.errorLabel);
    throw new Error(error.message);
  }
}

/**
 * Send via Resend and require API proof of enqueue (numeric/string id).
 * Throws if Resend is not configured — callers that must avoid DB writes when mail fails should use this.
 */
async function sendRenderedEmailRequireResendDelivery(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  devLogPayload: Record<string, unknown>;
  errorLabel: string;
}): Promise<{ resendEmailId: string }> {
  const resend = getResend();
  const from = getFromAddress();
  if (!resend || !from) {
    log.error({ ...params.devLogPayload, hasKey: !!resend, hasFrom: !!from }, 'Resend niet geconfigureerd');
    throw new Error(
      'E-mail kan niet worden verstuurd: stel RESEND_API_KEY en RESEND_FROM in voor productie gebruik.'
    );
  }

  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    log.error({ err: error, to: params.to }, params.errorLabel);
    throw new Error(error.message);
  }
  const id = data?.id;
  if (id == null || String(id).trim() === '') {
    log.error({ data, to: params.to }, `${params.errorLabel}: missing Resend message id`);
    throw new Error('E-mail versturen lukte niet: geen bevestiging van Resend (ontbrekend bericht‑id).');
  }
  return { resendEmailId: String(id) };
}

export async function sendPasswordResetEmailViaResend(params: {
  to: string;
  url: string;
  userName: string | null;
  /** `'setup'`: eerste wachtwoord; default forgot-flow */
  purpose?: 'reset' | 'setup';
}): Promise<void> {
  const purpose = params.purpose ?? 'reset';
  const { html, text } = await renderPasswordResetBodies({
    url: params.url,
    userName: params.userName,
    purpose,
  });
  const subject =
    purpose === 'setup'
      ? 'Welkom — stel je wachtwoord in — De Doktersdienst'
      : 'Wachtwoord resetten — De Doktersdienst';

  await sendRenderedEmail({
    to: params.to,
    subject,
    html,
    text,
    devLogPayload: { to: params.to, subject, url: params.url, purpose },
    warnMessage:
      'Resend niet geconfigureerd (RESEND_API_KEY / RESEND_FROM); reset/setup-mail alleen gelogd',
    errorLabel:
      purpose === 'setup'
        ? 'Resend password setup mail failed'
        : 'Resend password reset failed',
  });
}

export async function sendPasswordSetupEmailViaResend(params: {
  to: string;
  url: string;
  userName: string | null;
}): Promise<void> {
  return sendPasswordResetEmailViaResend({ ...params, purpose: 'setup' });
}

export async function sendMagicLinkEmailViaResend(params: {
  to: string;
  url: string;
}): Promise<void> {
  const { html, text } = await renderMagicLinkBodies({ url: params.url });
  const subject = 'Inloggen — De Doktersdienst';

  await sendRenderedEmail({
    to: params.to,
    subject,
    html,
    text,
    devLogPayload: { to: params.to, subject, url: params.url },
    warnMessage:
      'Resend niet geconfigureerd; magic-link-mail alleen gelogd',
    errorLabel: 'Resend magic link failed',
  });
}

export async function sendVerificationEmailViaResend(params: {
  to: string;
  url: string;
  userName: string | null;
}): Promise<void> {
  const { html, text } = await renderVerificationBodies({
    url: params.url,
    variant: 'signup',
    userName: params.userName,
  });
  const subject = 'Bevestig je e-mailadres — De Doktersdienst';

  await sendRenderedEmail({
    to: params.to,
    subject,
    html,
    text,
    devLogPayload: { to: params.to, subject, url: params.url, flow: 'signup-verify' },
    warnMessage:
      'Resend niet geconfigureerd; verificatiemail alleen gelogd',
    errorLabel: 'Resend verification email failed',
  });
}

/** Same template as signup verify, but refuses to return until Resend returns a message id (no silent dev skip). */
export async function sendVerificationEmailViaResendWithProof(params: {
  to: string;
  url: string;
  userName: string | null;
}): Promise<{ resendEmailId: string }> {
  const { html, text } = await renderVerificationBodies({
    url: params.url,
    variant: 'signup',
    userName: params.userName,
  });
  const subject = 'Bevestig je e-mailadres — De Doktersdienst';

  return sendRenderedEmailRequireResendDelivery({
    to: params.to,
    subject,
    html,
    text,
    devLogPayload: { to: params.to, subject, url: params.url, flow: 'signup-verify-strict' },
    errorLabel: 'Resend verification email failed',
  });
}

export async function sendInvitationVerifyEmailViaResend(params: {
  to: string;
  url: string;
  invitedByName?: string | null;
}): Promise<void> {
  const { html, text } = await renderVerificationBodies({
    url: params.url,
    variant: 'invite',
    invitedByName: params.invitedByName,
  });
  const subject = 'Bevestig je uitnodiging — De Doktersdienst';

  await sendRenderedEmail({
    to: params.to,
    subject,
    html,
    text,
    devLogPayload: {
      to: params.to,
      subject,
      url: params.url,
      flow: 'invite-verify',
    },
    warnMessage:
      'Resend niet geconfigureerd; uitnodigingsmail alleen gelogd',
    errorLabel: 'Resend invitation verify email failed',
  });
}
