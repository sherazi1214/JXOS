// ============================================================================
// PATCH  /api/assets/:id — update/reassign an asset (assigning it to an
//                           employee automatically flips status to
//                           'assigned' unless the caller overrides it).
// DELETE /api/assets/:id — remove an asset record.
//
// RBAC: assets.update / assets.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, ASSET_PERMISSIONS } from '@/lib/rbac';

const ASSET_SELECT = `
  *,
  employee:assigned_to(id, full_name, employee_code)
`;

const updateSchema = z.object({
  asset_type: z.string().min(1).optional(),
  serial_number: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).optional(),
  warranty_until: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['available', 'assigned', 'in_repair', 'retired']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ASSET_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid asset data.' },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.assigned_to !== undefined && parsed.data.status === undefined) {
    patch.status = parsed.data.assigned_to ? 'assigned' : 'available';
  }

  const db = supabaseServer();
  const { data: asset, error } = await db
    .from('assets')
    .update(patch)
    .eq('id', resolvedParams.id)
    .select(ASSET_SELECT)
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: 'Failed to update asset.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'asset',
    entity_id: asset.id,
    new_value: asset,
  });

  return NextResponse.json({ asset });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ASSET_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { error } = await db.from('assets').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete asset.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'asset',
    entity_id: resolvedParams.id,
  });

  return NextResponse.json({ success: true });
}
