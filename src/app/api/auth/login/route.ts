// ============================================================================
// POST /api/auth/login
//
// Verifies email + password against the `users` table, signs a JWT session,
// and sets it as an httpOnly cookie. Returns the authenticated user's public
// profile (never the password hash).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/db';
import { verifyPassword, signSession, authCookieName } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please provide a valid email and password.' },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const db = supabaseServer();

  const { data: user, error } = await db
    .from('users')
    .select('id, email, password_hash, full_name, avatar_url, role_id, is_active, roles(name)')
    .eq('email', email)
    .is('deleted_at', null)
    .single();

  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't leak which one it was.
  const invalidCredentials = () =>
    NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  if (error || !user) return invalidCredentials();
  if (!user.is_active) {
    return NextResponse.json(
      { error: 'This account has been deactivated. Contact your administrator.' },
      { status: 403 }
    );
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) return invalidCredentials();

  const token = signSession({ userId: user.id, roleId: user.role_id });

  await db
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: (user as any).roles?.name ?? null,
    },
  });

  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_SECONDS,
  });

  return response;
}
