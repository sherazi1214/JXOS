// ============================================================================
// GET    /api/opportunities/:id  — fetch a single opportunity
// PATCH  /api/opportunities/:id  — update value/probability/status/owner/etc
// DELETE /api/opportunities/:id  — remove an opportunity
//
// RBAC: opportunities.view / opportunities.update / opportunities.delete.
// Setting status to 'won' or 'lost' automatically stamps closed_at and logs
// a note on the parent lead so the timeline stays readable without the
// salesperson having to log it manually.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, OPPORTUNITY_PERMISSIONS, LEAD_PERMISSIONS } from '@/lib/rbac';

const OPPORTUNITY_SELECT =
  '*, lead:leads(id, company_name, lead_code), owner:employees(id, full_name, employee_code)';

const updateOpportunitySchema = z.object({
  name: z.string().min(1).optional(),
  value: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  probability_pct: z.coerce.number().min(0).max(100).optional(),
  expected_close_date: z.string().optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  owner_id: z.string().uuid().optional().nullable(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(OPPORTUNITY_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('id', id)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 }) };
  }

  const isOwner = existing.owner_id && existing.owner_id === user.employee_id;

  return { user, db, permissions, canViewAll, isOwner, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(OPPORTUNITY_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ opportunity: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(OPPORTUNITY_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json(
      { error: 'You can only edit opportunities you own.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateOpportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid opportunity data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const canAssign = permissions.includes(LEAD_PERMISSIONS.ASSIGN);
  const updates: Record<string, any> = { ...input, updated_at: new Date().toISOString() };
  if ('owner_id' in updates && !canAssign) delete updates.owner_id;

  const statusChangedToClosed =
    input.status && input.status !== 'open' && input.status !== existing.status;
  if (statusChangedToClosed) {
    updates.closed_at = new Date().toISOString();
  } else if (input.status === 'open' && existing.status !== 'open') {
    updates.closed_at = null; // reopened
  }

  const { data: updated, error } = await db
    .from('opportunities')
    .update(updates)
    .eq('id', resolvedParams.id)
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update opportunity.' }, { status: 500 });
  }

  if (input.status && input.status !== existing.status) {
    await db.from('lead_activities').insert({
      lead_id: existing.lead_id,
      activity_type: 'status_change',
      performed_by: user.employee_id,
      summary: `Opportunity "${existing.name}" marked ${input.status}.`,
    });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'opportunity',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ opportunity: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(OPPORTUNITY_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db.from('opportunities').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete opportunity.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'opportunity',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
