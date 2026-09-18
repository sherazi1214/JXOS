// ============================================================================
// GET    /api/clients/:id  — fetch a single client (with contacts, services,
//                             and contracts nested in)
// PATCH  /api/clients/:id  — update a client
// DELETE /api/clients/:id  — soft-delete a client
//
// RBAC: clients.view / clients.update / clients.delete / clients.assign.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const CLIENT_DETAIL_SELECT = `
  *,
  account_manager:employees(id, full_name, employee_code),
  client_contacts(*),
  client_services(*, service:services(id, name)),
  contracts(id, contract_code, status, contract_value, monthly_recurring_amt, currency, start_date, end_date)
`;

const updateClientSchema = z.object({
  company_name: z.string().min(1).optional(),
  country: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  account_manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive', 'churned']).optional(),
  client_since: z.string().optional(),
  notes: z.string().optional().nullable(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(CLIENT_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('clients')
    .select(CLIENT_DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Client not found.' }, { status: 404 }) };
  }

  const isOwner = existing.account_manager_id && existing.account_manager_id === user.employee_id;

  return { user, db, permissions, canViewAll, isOwner, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(CLIENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ client: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(CLIENT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json(
      { error: 'You can only edit clients you manage.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid client data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const canAssign = permissions.includes(CLIENT_PERMISSIONS.ASSIGN);
  const updates: Record<string, any> = { ...input, updated_at: new Date().toISOString() };
  if ('account_manager_id' in updates && !canAssign) delete updates.account_manager_id;

  const { data: updated, error } = await db
    .from('clients')
    .update(updates)
    .eq('id', resolvedParams.id)
    .select(CLIENT_DETAIL_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update client.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'client',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ client: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(CLIENT_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete client.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'client',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
