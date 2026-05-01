import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  renderMagicLinkBodies: vi.fn(),
  renderPasswordResetBodies: vi.fn(),
  renderVerificationBodies: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: hoisted.sendMock };
  },
}));

vi.mock('@/lib/render-auth-email', () => ({
  renderMagicLinkBodies: hoisted.renderMagicLinkBodies,
  renderPasswordResetBodies: hoisted.renderPasswordResetBodies,
  renderVerificationBodies: hoisted.renderVerificationBodies,
}));

describe('resend-email auth helpers', () => {
  beforeEach(() => {
    hoisted.renderMagicLinkBodies.mockResolvedValue({
      html: '<html>magic</html>',
      text: 'magic text',
    });
    hoisted.renderPasswordResetBodies.mockResolvedValue({
      html: '<html>pwd</html>',
      text: 'pwd text',
    });
    hoisted.renderVerificationBodies.mockResolvedValue({
      html: '<html>ver</html>',
      text: 'ver text',
    });
    hoisted.sendMock.mockResolvedValue({ data: { id: '1' }, error: null });
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM', 'Doktersdienst <noreply@example.com>');
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('sendMagicLinkEmailViaResend sends rendered html and NL subject', async () => {
    const { sendMagicLinkEmailViaResend } = await import('@/lib/resend-email');
    await sendMagicLinkEmailViaResend({
      to: 'user@example.com',
      url: 'https://x/m',
    });

    expect(hoisted.renderMagicLinkBodies).toHaveBeenCalledWith({
      url: 'https://x/m',
    });
    expect(hoisted.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Inloggen — De Doktersdienst',
        html: '<html>magic</html>',
        text: 'magic text',
      })
    );
  });

  it('sendPasswordResetEmailViaResend uses reset purpose by default', async () => {
    const { sendPasswordResetEmailViaResend } = await import('@/lib/resend-email');
    await sendPasswordResetEmailViaResend({
      to: 'u@ex.nl',
      url: 'https://r',
      userName: 'N',
    });

    expect(hoisted.renderPasswordResetBodies).toHaveBeenCalledWith({
      url: 'https://r',
      userName: 'N',
      purpose: 'reset',
    });
    expect(hoisted.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Wachtwoord resetten — De Doktersdienst',
      })
    );
  });

  it('sendPasswordSetupEmailViaResend uses setup purpose', async () => {
    const { sendPasswordSetupEmailViaResend } = await import('@/lib/resend-email');
    await sendPasswordSetupEmailViaResend({
      to: 'new@ex.nl',
      url: 'https://s',
      userName: null,
    });

    expect(hoisted.renderPasswordResetBodies).toHaveBeenCalledWith({
      url: 'https://s',
      userName: null,
      purpose: 'setup',
    });
    expect(hoisted.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Welkom — stel je wachtwoord in — De Doktersdienst',
      })
    );
  });

  it('sendVerificationEmailViaResend renders signup verification', async () => {
    const { sendVerificationEmailViaResend } = await import('@/lib/resend-email');
    await sendVerificationEmailViaResend({
      to: 'u@ex.nl',
      url: 'https://v',
      userName: 'X',
    });

    expect(hoisted.renderVerificationBodies).toHaveBeenCalledWith({
      url: 'https://v',
      variant: 'signup',
      userName: 'X',
    });
    expect(hoisted.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Bevestig je e-mailadres — De Doktersdienst',
      })
    );
  });

  it('sendInvitationVerifyEmailViaResend uses invite variant', async () => {
    const { sendInvitationVerifyEmailViaResend } = await import('@/lib/resend-email');
    await sendInvitationVerifyEmailViaResend({
      to: 'i@ex.nl',
      url: 'https://i',
      invitedByName: 'Q',
    });

    expect(hoisted.renderVerificationBodies).toHaveBeenCalledWith({
      url: 'https://i',
      variant: 'invite',
      invitedByName: 'Q',
    });
    expect(hoisted.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Bevestig je uitnodiging — De Doktersdienst',
      })
    );
  });

  it('does not call Resend when API key is missing but still renders', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_FROM', 'X <on@example.com>');
    hoisted.sendMock.mockClear();

    vi.resetModules();
    const { sendMagicLinkEmailViaResend } = await import('@/lib/resend-email');
    await sendMagicLinkEmailViaResend({
      to: 'u@n.nl',
      url: 'https://u',
    });

    expect(hoisted.sendMock).not.toHaveBeenCalled();
    expect(hoisted.renderMagicLinkBodies).toHaveBeenCalledWith({ url: 'https://u' });
  });
});
