type HeaderRecord = Partial<Record<string, string | string[] | undefined>>;

function firstHeader(headers: HeaderRecord, name: string): string | undefined {
  const v = headers[name];
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string') return undefined;
  const trimmed = s.split(',')[0]?.trim();
  return trimmed || undefined;
}

/** Parse and normalize `origin`/`window.location.origin` (http/https, hostname-only left of path). */
export function canonicalHttpSiteOrigin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Public browser origin derived from incoming request proxy headers (same notion as opening the SPA).
 */
export function getPublicSiteOriginFromRequest(req: { headers?: HeaderRecord }): string | null {
  const host =
    firstHeader(req.headers ?? {}, 'x-forwarded-host') ??
    firstHeader(req.headers ?? {}, 'host');

  if (!host || /\s/.test(host) || /\.\.|%2[Ff]|%5[Cc]/i.test(host)) {
    return null;
  }

  let protoRaw = firstHeader(req.headers ?? {}, 'x-forwarded-proto')?.toLowerCase();
  if (protoRaw !== 'https' && protoRaw !== 'http') {
    const originHdr = req.headers?.origin;
    protoRaw =
      typeof originHdr === 'string' && originHdr.startsWith('https') ? 'https' : undefined;
    if (!protoRaw) {
      protoRaw = host.endsWith(':443') ? 'https' : 'http';
    }
  }

  try {
    return new URL(`${protoRaw}://${host}`).origin;
  } catch {
    return null;
  }
}

/** Browsers typically send `Origin` on POST; same value as `window.location.origin` for same‑origin APIs. */
function getPublicSiteOriginFromOriginHeader(req: { headers?: HeaderRecord }): string | null {
  const hdr = req.headers?.origin;
  const raw =
    typeof hdr === 'string'
      ? hdr.trim()
      : Array.isArray(hdr)
        ? String(hdr[0] ?? '').trim()
        : '';
  return raw ? canonicalHttpSiteOrigin(raw) : null;
}

/** Resolved public site origin suitable for outbound links (`Host`/forward‑headers, otherwise `Origin`). */
export function getEffectivePublicSiteOriginForInvite(req: { headers?: HeaderRecord }): string | null {
  return (
    getPublicSiteOriginFromRequest(req) ??
    getPublicSiteOriginFromOriginHeader(req)
  );
}

export type InviteAuthApiBaseResult =
  | { ok: true; authApiBase: string }
  | { ok: false; error: string };

/**
 * Base URL (`…/api/auth`) for invitation verify links.
 * Uses `Host` / `X‑Forwarded‑*` plus optional `Origin` (same origin as `window` for POST from the SPA).
 * If `inviteInitiatedOrigin` is sent, it must agree with that resolution (CSRF/phishing‑link guard).
 * Falls back to `BETTER_AUTH_URL`‑style env when headers are missing (e.g. scripted calls).
 */
export function resolveInviteEmailAuthApiBase(
  req: { headers?: HeaderRecord },
  inviteInitiatedOrigin?: string | null | undefined
): InviteAuthApiBaseResult {
  const authoritative = getEffectivePublicSiteOriginForInvite(req);
  const claimedRaw =
    inviteInitiatedOrigin == null ? null : canonicalHttpSiteOrigin(String(inviteInitiatedOrigin));

  if (claimedRaw && authoritative && claimedRaw !== authoritative) {
    return {
      ok: false,
      error:
        'De sessie‑URL komt niet overeen met de server. Vernieuw de pagina en probeer opnieuw.',
    };
  }

  if (authoritative) {
    return { ok: true, authApiBase: `${authoritative.replace(/\/+$/, '')}/api/auth` };
  }

  try {
    return { ok: true, authApiBase: getBetterAuthApiBase() };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error:
        `Serverconfiguratiefout (Better Auth‑URL): ${detail}. Neem contact op met de beheerder.`,
    };
  }
}

/**
 * Public base URL for Better Auth HTTP routes (`.../api/auth/verify-email`, etc.).
 * Mirrors `withPath(..., '/api/auth')` in better-auth/client (pathname `/` ⇒ append `/api/auth`).
 */
export function getBetterAuthApiBase(rawOverride?: string | null): string {
  const raw =
    (typeof rawOverride === 'string' && rawOverride.trim() !== ''
      ? rawOverride
      : undefined) ??
    process.env.BETTER_AUTH_URL?.trim() ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() ??
    'http://localhost:3005';

  let href = raw.replace(/\/+$/, '');
  if (!href.includes('://')) {
    href = `http://${href}`;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new Error(`Invalid Better Auth URL: ${raw}`);
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/') {
    return `${url.origin}${path}`;
  }
  return `${url.origin}/api/auth`;
}
