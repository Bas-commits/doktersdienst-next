/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEmailTemplateSiteUrl,
  renderMagicLinkBodies,
  renderPasswordResetBodies,
  renderVerificationBodies,
} from '@/lib/render-auth-email';

describe('render-auth-email', () => {
  beforeEach(() => {
    vi.stubEnv(
      'NEXT_PUBLIC_BETTER_AUTH_URL',
      'https://auth.example.nl'
    );
    vi.stubEnv('EMAIL_LOGO_URL', 'https://cdn.example/logo.png');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getEmailTemplateSiteUrl strips trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_BETTER_AUTH_URL', 'https://x.nl/');
    expect(getEmailTemplateSiteUrl()).toBe('https://x.nl');
  });

  it('renderMagicLinkBodies includes branded copy', async () => {
    const { html, text } = await renderMagicLinkBodies({
      url: 'https://app.nl/magic?token=a',
      userName: null,
    });
    expect(html).toContain('Inloggen op De Doktersdienst');
    expect(html).toContain('https://cdn.example/logo.png');
    expect(html).toContain('https://app.nl/magic?token=a');
    expect(text).toContain('Inloggen bij De Doktersdienst');
  });

  it('renderVerificationBodies signup variant', async () => {
    const { html } = await renderVerificationBodies({
      url: 'https://verify',
      variant: 'signup',
      userName: 'Jan',
    });
    expect(html).toContain('Bevestig je e-mailadres');
    expect(html).toContain('Hallo Jan,');
    expect(html).toContain('Bedankt voor je registratie');
  });

  it('renderVerificationBodies invite variant', async () => {
    const { html } = await renderVerificationBodies({
      url: 'https://invite',
      variant: 'invite',
      invitedByName: 'Piet',
    });
    expect(html).toContain('Je uitnodiging voor De Doktersdienst');
    expect(html).toContain('Piet heeft je uitgenodigd');
  });

  it('renderPasswordResetBodies reset vs setup', async () => {
    const reset = await renderPasswordResetBodies({
      url: 'https://reset',
      userName: null,
      purpose: 'reset',
    });
    expect(reset.html).toContain('Wachtwoord opnieuw instellen');

    const setup = await renderPasswordResetBodies({
      url: 'https://setup',
      userName: 'Kim',
      purpose: 'setup',
    });
    expect(setup.html).toContain('Welkom bij De Doktersdienst');
    expect(setup.html).toContain('Wachtwoord instellen');
    expect(setup.html).toContain('Hallo Kim,');
  });
});
