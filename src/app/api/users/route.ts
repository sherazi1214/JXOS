// ============================================================================
// GET  /api/users  — list every login account with its role (CEO/Admin only)
// POST /api/users  — create a new login account pinned to a single role
//
// This is the piece that was missing: without it, the only way to get a
// second account into the system was the one-time seed:admin script, which
// always creates a CEO/Admin. Every account created here is scoped to
// exactly the role picked at creation time — a "Finance" user gets the
// Finance role's permissions and nothing else, checked server-side on
// every single API route via rbac.ts (see getPermissionsForRole/
// requirePermission). The role picker on the *login* screen is cosmetic;
// this is what actually determines access.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRole, hashPassword } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';

const createUserSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role_id: z.string().uuid('Please choose a role'),
});

async function requireAdmin() {
  const user = await getCurrentUserWithRole();
  if (!user) return { user: null, error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  if (user.roleName !== 'CEO/Admin') {
    return { user: null, error: NextResponse.json({ error: 'Only CEO/Admin can manage users.' }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const db = supabaseServer();
  const { data, error: dbError } = await db
    .from('users')
    .select('id, full_name, email, is_active, last_login_at, created_at, role_id, roles(id, name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 });
  }

  const users = (data ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    is_active: row.is_active,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    role: row.roles ? { id: row.roles.id, name: row.roles.name } : null,
  }));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input.' },
      { status: 400 }
    );
  }

  const { full_name, email, password, role_id } = parsed.data;
  const db = supabaseServer();

  const { data: role } = await db.from('roles').select('id, name').eq('id', role_id).single();
  if (!role) {
    return NextResponse.json({ error: 'Selected role does not exist.' }, { status: 400 });
  }

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
  }

  const password_hash = await hashPassword(password);

  const { data: newUser, error: insertError } = await db
    .from('users')
    .insert({
      full_name,
      email,
      password_hash,
      role_id,
      is_active: true,
    })
    .select('id, full_name, email, is_active, created_at, role_id')
    .single();

  if (insertError || !newUser) {
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      user: {
        ...newUser,
        role: { id: role.id, name: role.name },
        created_by: admin?.id,
      },
    },
    { status: 201 }
  );
}
