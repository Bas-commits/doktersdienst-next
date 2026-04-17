import { Resend } from 'resend';
import { logger } from '@/lib/logger';

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

function standardLinkEmailHtml(params: {
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  const { title, intro, actionLabel, actionUrl, footer } = params;
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:8px;padding:32px 28px;border:1px solid #e5e5e5;">
          <tr><td style="font-size:20px;font-weight:600;color:#111;">${title}</td></tr>
          <tr><td style="height:16px;"></td></tr>
          <tr><td style="font-size:15px;line-height:1.5;color:#333;">${intro}</td></tr>
          <tr><td style="height:24px;"></td></tr>
          <tr><td align="center">
            <a href="${actionUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;font-weight:600;">${actionLabel}</a>
          </td></tr>
          <tr><td style="height:20px;"></td></tr>
          <tr><td style="font-size:13px;line-height:1.5;color:#666;">${footer}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmailViaResend(params: {
  to: string;
  url: string;
  userName: string | null;
}): Promise<void> {
  const { to, url, userName } = params;
  const resend = getResend();
  const from = getFromAddress();
  const greeting = userName ? `Hallo ${userName},` : 'Hallo,';
  const subject = 'Wachtwoord resetten — Doktersdienst';
  const html = standardLinkEmailHtml({
    title: 'Wachtwoord resetten',
    intro: `${greeting}<br/><br/>Klik op de knop hieronder om een nieuw wachtwoord in te stellen. Deze link is beperkt geldig.`,
    actionLabel: 'Nieuw wachtwoord instellen',
    actionUrl: url,
    footer: `Als de knop niet werkt, kopieer en plak deze link in je browser:<br/><span style="word-break:break-all;color:#111;">${url}</span>`,
  });
  const text = `${greeting}\n\nStel je wachtwoord opnieuw in via deze link (eenmalig, beperkt geldig):\n${url}\n`;

  if (!resend || !from) {
    log.warn(
      { to, hasKey: !!resend, hasFrom: !!from },
      'Resend niet geconfigureerd (RESEND_API_KEY / RESEND_FROM); reset-mail alleen gelogd'
    );
    console.log('[auth email] Password reset (dev)', { to, subject, url });
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) {
    log.error({ err: error, to }, 'Resend password reset failed');
    throw new Error(error.message);
  }
}

export async function sendMagicLinkEmailViaResend(params: {
  to: string;
  url: string;
}): Promise<void> {
  const { to, url } = params;
  const resend = getResend();
  const from = getFromAddress();
  const subject = 'Inloggen — Doktersdienst';
  const html = standardLinkEmailHtml({
    title: 'Inloggen',
    intro: 'Klik op de knop hieronder om in te loggen op Doktersdienst. Deze link is beperkt geldig en kan maar één keer worden gebruikt.',
    actionLabel: 'Inloggen',
    actionUrl: url,
    footer: `Als de knop niet werkt, kopieer en plak deze link in je browser:<br/><span style="word-break:break-all;color:#111;">${url}</span>`,
  });
  const text = `Log in op Doktersdienst via deze link (eenmalig, beperkt geldig):\n${url}\n`;

  if (!resend || !from) {
    log.warn(
      { to, hasKey: !!resend, hasFrom: !!from },
      'Resend niet geconfigureerd; magic-link-mail alleen gelogd'
    );
    console.log('[auth email] Magic link (dev)', { to, subject, url });
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) {
    log.error({ err: error, to }, 'Resend magic link failed');
    throw new Error(error.message);
  }
}
