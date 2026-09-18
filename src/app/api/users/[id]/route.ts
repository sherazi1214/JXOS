// ============================================================================
// PATCH /api/users/:id — CEO/Admin only. Toggle is_active (suspend/restore a
// login) or move a user to a different role. Deactivating immediately blocks
// login and every RBAC check (getCurrentUser filters on is_active), without
// deleting the account's history.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRole } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';

const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role_id: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const admin = await getCurrentUserWithRole();
  if (!admin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  if (admin.roleName !== 'CEO/Admin') {
    return NextResponse.json({ error: 'Only CEO/Admin can manage users.' }, { status: 403 });
  }
  if (resolvedParams.id === admin.id) {
    return NextResponse.json(
      { error: 'You cannot change your own access from here.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.is_active && parsed.data.is_active !== false && !parsed.data.role_id)) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from('users')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select('id, full_name, email, is_active, role_id, roles(id, name)')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
