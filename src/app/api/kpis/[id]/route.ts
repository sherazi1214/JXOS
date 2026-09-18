// ============================================================================
// PATCH  /api/kpis/:id — update actual_value (progress) or target_value.
// DELETE /api/kpis/:id — remove a KPI target.
//
// RBAC: kpis.manage.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, KPI_PERMISSIONS } from '@/lib/rbac';

const updateSchema = z.object({
  target_value: z.coerce.number().optional(),
  actual_value: z.coerce.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(KPI_PERMISSIONS.MANAGE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid KPI data.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data: kpi, error } = await db
    .from('company_kpis')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select('*')
    .single();

  if (error || !kpi) {
    return NextResponse.json({ error: 'Failed to update KPI.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'company_kpi',
    entity_id: kpi.id,
    new_value: kpi,
  });

  return NextResponse.json({ kpi });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(KPI_PERMISSIONS.MANAGE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { error } = await db.from('company_kpis').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete KPI.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'company_kpi',
    entity_id: resolvedParams.id,
  });

  return NextResponse.json({ success: true });
}
