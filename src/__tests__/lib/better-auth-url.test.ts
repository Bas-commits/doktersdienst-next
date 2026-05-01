import { describe, it, expect } from 'vitest';
import {
  getBetterAuthApiBase,
  getEffectivePublicSiteOriginForInvite,
  getPublicSiteOriginFromRequest,
  resolveInviteEmailAuthApiBase,
} from '@/lib/better-auth-url';

describe('getBetterAuthApiBase', () => {
  it('appends /api/auth when URL is origin only', () => {
    expect(getBetterAuthApiBase('http://localhost:3005')).toBe('http://localhost:3005/api/auth');
    expect(getBetterAuthApiBase('https://example.com')).toBe('https://example.com/api/auth');
  });

  it('keeps pathname when mounting is already under /api/auth', () => {
    expect(getBetterAuthApiBase('https://example.com/api/auth')).toBe(
      'https://example.com/api/auth'
    );
    expect(getBetterAuthApiBase('http://localhost:3005/api/auth/')).toBe(
      'http://localhost:3005/api/auth'
    );
  });

  it('adds protocol for host:port', () => {
    expect(getBetterAuthApiBase('localhost:8080')).toBe('http://localhost:8080/api/auth');
  });
});

describe('getPublicSiteOriginFromRequest', () => {
  it('builds origin from Host and http by default', () => {
    expect(
      getPublicSiteOriginFromRequest({ headers: { host: 'localhost:3005' } })
    ).toBe('http://localhost:3005');
  });

  it('respects x-forwarded-host and x-forwarded-proto', () => {
    expect(
      getPublicSiteOriginFromRequest({
        headers: {
          'x-forwarded-host': 'dev.example.com',
          'x-forwarded-proto': 'https',
        },
      })
    ).toBe('https://dev.example.com');
  });
});

describe('getEffectivePublicSiteOriginForInvite', () => {
  it('falls back to Origin when forwarded host is absent', () => {
    expect(
      getEffectivePublicSiteOriginForInvite({
        headers: { origin: 'https://app.example.com' },
      })
    ).toBe('https://app.example.com');
  });
});

describe('resolveInviteEmailAuthApiBase', () => {
  it('uses Host-derived origin and accepts matching inviteInitiatedOrigin', () => {
    const r = resolveInviteEmailAuthApiBase(
      { headers: { host: 'localhost:3005', origin: 'http://localhost:3005' } },
      'http://localhost:3005'
    );
    expect(r).toEqual({ ok: true, authApiBase: 'http://localhost:3005/api/auth' });
  });

  it('rejects inviteInitiatedOrigin that disagrees with request', () => {
    const r = resolveInviteEmailAuthApiBase(
      { headers: { host: 'localhost:3005', origin: 'http://localhost:3005' } },
      'https://evil.test'
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/komt niet overeen/);
  });
});
