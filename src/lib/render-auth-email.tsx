import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import MagicLinkLoginEmail from '@email/magic-link-login';
import ResetPasswordEmail from '@email/reset-password';
import type { ResetPasswordPurpose } from '@email/reset-password';
import InviteVerifyEmail from '@email/invite-verify-email';
import type { VerifyEmailVariant } from '@email/invite-verify-email';

/** Publieke origin voor shell (logo-fallback `{origin}/logo.png`); logo meestal via `EMAIL_LOGO_URL`. */
export function getEmailTemplateSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    '';
  return raw.replace(/\/$/, '');
}

async function toHtmlAndText(jsx: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(jsx);
  const text = await render(jsx, { plainText: true });
  return { html, text };
}

export async function renderMagicLinkBodies(params: {
  url: string;
  userName?: string | null;
}): Promise<{ html: string; text: string }> {
  const siteUrl = getEmailTemplateSiteUrl();
  return toHtmlAndText(
    <MagicLinkLoginEmail magicLinkUrl={params.url} siteUrl={siteUrl} userName={params.userName} />
  );
}

export async function renderPasswordResetBodies(params: {
  url: string;
  userName: string | null;
  purpose?: ResetPasswordPurpose;
}): Promise<{ html: string; text: string }> {
  const siteUrl = getEmailTemplateSiteUrl();
  return toHtmlAndText(
    <ResetPasswordEmail
      resetUrl={params.url}
      siteUrl={siteUrl}
      userName={params.userName}
      purpose={params.purpose ?? 'reset'}
    />
  );
}

export async function renderVerificationBodies(params: {
  url: string;
  variant: VerifyEmailVariant;
  userName?: string | null;
  invitedByName?: string | null;
}): Promise<{ html: string; text: string }> {
  const siteUrl = getEmailTemplateSiteUrl();
  return toHtmlAndText(
    <InviteVerifyEmail
      verifyUrl={params.url}
      siteUrl={siteUrl}
      variant={params.variant}
      accountName={params.variant === 'signup' ? params.userName ?? null : undefined}
      invitedByName={params.invitedByName}
    />
  );
}
