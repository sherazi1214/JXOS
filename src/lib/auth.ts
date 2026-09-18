// ============================================================================
// Authentication helpers: password hashing + JWT session tokens.
//
// Flow:
//   1. login route verifies email/password against `users` table
//   2. on success, sign a JWT containing { userId, roleId } and set it as
//      an httpOnly cookie (see COOKIE_NAME in .env.example)
//   3. getCurrentUser() reads + verifies that cookie on every protected
//      request (middleware, API routes, Server Components)
// ============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/db';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import type { User } from '@/types/database';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = AUTH_COOKIE_NAME;

export interface SessionPayload {
  userId: string;
  roleId: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: SessionPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set.');
  const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Reads the session cookie and returns the authenticated user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSessionFromCookie();
  if (!session) return null;

  const { data, error } = await supabaseServer()
    .from('users')
    .select('*')
    .eq('id', session.userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !data) return null;
  return data as User;
}

export interface AuthenticatedUser extends User {
  roleName: string;
}

/** Same as getCurrentUser(), but also resolves the human-readable role name
 *  (e.g. "CEO/Admin") — used anywhere the UI needs to display or branch on
 *  the role, like the dashboard shell. */
export async function getCurrentUserWithRole(): Promise<AuthenticatedUser | null> {
  const session = await getSessionFromCookie();
  if (!session) return null;

  const { data, error } = await supabaseServer()
    .from('users')
    .select('*, roles(name)')
    .eq('id', session.userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !data) return null;

  const { roles, ...user } = data as any;
  return { ...user, roleName: roles?.name ?? 'Employee' } as AuthenticatedUser;
}

export const authCookieName = COOKIE_NAME;
