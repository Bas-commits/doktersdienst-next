import { NextRequest, NextResponse } from 'next/server';

/**
 * Global auth middleware: redirects unauthenticated users to /login for
 * protected pages. API routes handle their own auth (returning 401),
 * but this catches routes that might forget.
 *
 * Public paths: /login, /api/auth/*, /api/health, /_next/*, /favicon.ico, static assets.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/health' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie?.value) {
    // API routes: return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Pages: redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|static/).*)',
  ],
};
