// ============================================================================
// PATCH  /api/subscriptions/:id — update a subscription (e.g. mark renewed by
//                                  bumping renewal_date, or toggle is_active).
// DELETE /api/subscriptions/:id — cancel/remove a subscription.
//
// RBAC: vendors.update / vendors.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, VENDOR_PERMISSIONS } from '@/lib/rbac';

const SUBSCRIPTION_SELECT = `
  *,
  vendor:vendors(id, name),
  owner:owner_id(id, full_name)
`;

const updateSchema = z.object({
  service_name: z.string().min(1).optional(),
  cost: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']).optional(),
  renewal_date: z.string().optional().nullable(),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'online_wallet', 'other'])
    .optional()
    .nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid subscription data.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data: subscription, error } = await db
    .from('subscriptions')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !subscription) {
    return NextResponse.json({ error: 'Failed to update subscription.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'subscription',
    entity_id: subscription.id,
    new_value: subscription,
  });

  return NextResponse.json({ subscription });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { error } = await db.from('subscriptions').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete subscription.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'subscription',
    entity_id: resolvedParams.id,
  });

  return NextResponse.json({ success: true });
}
