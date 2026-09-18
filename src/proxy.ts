// ============================================================================
// Proxy (formerly "Middleware", renamed in Next.js 16) — fast, edge-level
// gate for protected routes.
//
// IMPORTANT: this only checks that a session cookie is PRESENT, as a cheap
// redirect for logged-out users. It does NOT verify the JWT signature or
// look up the user/role — `jsonwebtoken` needs Node's crypto module, which
// isn't available in the Edge runtime this file runs in by default.
//
// Real authorization (verifying the token, checking `is_active`, checking
// RBAC permissions) happens server-side in `getCurrentUser()` / `rbac.ts`
// on every page load and every API route. Treat this file as a UX
// convenience, never as the security boundary.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

const PUBLIC_PATHS = ['/login'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSessionCookie = Boolean(req.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (!isPublic && !hasSessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *  - api routes (auth themselves need to run; other API routes do
     *    their own getCurrentUser() check)
     *  - Next internals and static assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
