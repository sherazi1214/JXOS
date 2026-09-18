// ============================================================================
// POST /api/auth/logout — clears the session cookie.
// ============================================================================

import { NextResponse } from 'next/server';
import { authCookieName } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(authCookieName, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
