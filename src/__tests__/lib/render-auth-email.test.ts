import { describe, expect, it } from 'vitest';
import {
  renderEmailChangeNoticeBodies,
  renderVerificationBodies,
} from '@/lib/render-auth-email';

describe('render-auth-email', () => {
  it('spreekt de ontvanger van de e-mailwijziging bij naam aan', async () => {
    const { text } = await renderVerificationBodies({
      url: 'https://voorbeeld.nl/bevestig',
      variant: 'email_change',
      userName: 'Jan Jansen',
    });

    expect(text).toContain('Hallo Jan Jansen');
  });

  it('laat de uitnodiging naamloos, want die ontvanger kennen we nog niet', async () => {
    const { text } = await renderVerificationBodies({
      url: 'https://voorbeeld.nl/uitnodiging',
      variant: 'invite',
      userName: 'Jan Jansen',
    });

    expect(text).not.toContain('Jan Jansen');
  });

  it('noemt in de melding beide adressen en geeft geen link mee', async () => {
    const { text, html } = await renderEmailChangeNoticeBodies({
      oldEmail: 'oud@voorbeeld.nl',
      newEmail: 'nieuw@voorbeeld.nl',
      userName: 'Jan Jansen',
    });

    expect(text).toContain('oud@voorbeeld.nl');
    expect(text).toContain('nieuw@voorbeeld.nl');
    // Geen bevestigingsknop: dit adres hoeft juist niets te bevestigen.
    expect(html).not.toContain('bevestig-email-wijziging');
    expect(text).toContain('U hoeft hier niets voor te doen');
  });
});
