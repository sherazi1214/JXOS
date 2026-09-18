// ============================================================================
// GET    /api/contracts/:id  — fetch a single contract
// PATCH  /api/contracts/:id  — update a contract (e.g. activate a draft,
//                               renew, terminate)
// DELETE /api/contracts/:id  — soft-delete a contract
//
// RBAC: contracts.view / contracts.update / contracts.delete, scoped to the
// contract's client the same way as clients/:id.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CONTRACT_PERMISSIONS } from '@/lib/rbac';

const CONTRACT_SELECT = `
  *,
  client:clients(id, company_name, client_code, account_manager_id),
  service:services(id, name),
  assigned_team_lead:employees(id, full_name, employee_code)
`;

const updateContractSchema = z.object({
  service_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().optional().nullable(),
  contract_value: z.number().nonnegative().optional(),
  monthly_recurring_amt: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  payment_terms: z.string().optional().nullable(),
  renewal_terms: z.string().optional().nullable(),
  assigned_team_lead_id: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'active', 'expired', 'terminated']).optional(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(CONTRACT_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('contracts')
    .select(CONTRACT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Contract not found.' }, { status: 404 }) };
  }

  const isOwner =
    (existing as any).client?.account_manager_id &&
    (existing as any).client.account_manager_id === user.employee_id;

  return { user, db, permissions, canViewAll, isOwner, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(CONTRACT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ contract: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(CONTRACT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json(
      { error: 'You can only edit contracts for clients you manage.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid contract data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const startDate = input.start_date ?? existing.start_date;
  const endDate = input.end_date !== undefined ? input.end_date : existing.end_date;
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 });
  }

  const { data: updated, error } = await db
    .from('contracts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(CONTRACT_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update contract.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'contract',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ contract: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(CONTRACT_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete contract.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'contract',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
