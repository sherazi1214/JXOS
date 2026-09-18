// ============================================================================
// GET    /api/leads/:id  — fetch a single lead
// PATCH  /api/leads/:id  — update a lead (stage/priority/fields/assignment)
// DELETE /api/leads/:id  — soft-delete a lead
//
// RBAC: leads.view / leads.update / leads.delete / leads.assign.
// A Salesperson without leads.view_all may only read/update leads assigned
// to them; reassigning a lead to someone else requires leads.assign.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, LEAD_PERMISSIONS } from '@/lib/rbac';
import { LEAD_STAGE_LABELS } from '@/lib/crm-constants';
import type { Lead, LeadStage } from '@/types/database';

const LEAD_SELECT = '*, assigned_employee:employees(id, full_name, employee_code)';

const updateLeadSchema = z.object({
  company_name: z.string().min(1).optional(),
  contact_person: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  source: z.string().min(1).optional(),
  campaign: z.string().optional().nullable(),
  service_interested: z.string().optional().nullable(),
  lead_value: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  stage: z
    .enum(['new', 'contacted', 'qualified', 'discovery', 'proposal_sent', 'negotiation', 'won', 'lost'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  next_follow_up_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(LEAD_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Lead not found.' }, { status: 404 }) };
  }

  const isOwner = existing.assigned_to && existing.assigned_to === user.employee_id;

  return { user, db, permissions, canViewAll, existing: existing as Lead & Record<string, any>, isOwner };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(LEAD_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ lead: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner, existing } = ctx;

  if (!permissions.includes(LEAD_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'You can only edit leads assigned to you.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid lead data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const canAssign = permissions.includes(LEAD_PERMISSIONS.ASSIGN);
  const updates: Record<string, any> = { ...input, updated_at: new Date().toISOString() };
  if ('email' in updates) updates.email = updates.email || null;

  if ('assigned_to' in updates) {
    if (!canAssign) {
      // Not allowed to reassign — drop the field silently rather than
      // erroring, since the UI shouldn't have shown this control to them.
      delete updates.assigned_to;
    }
  }

  const stageChanged = input.stage && input.stage !== existing.stage;

  const { data: updated, error } = await db
    .from('leads')
    .update(updates)
    .eq('id', resolvedParams.id)
    .select(LEAD_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update lead.' }, { status: 500 });
  }

  if (stageChanged) {
    const fromLabel = LEAD_STAGE_LABELS[existing.stage as LeadStage];
    const toLabel = LEAD_STAGE_LABELS[input.stage as LeadStage];
    await db.from('lead_activities').insert({
      lead_id: resolvedParams.id,
      activity_type: 'status_change',
      performed_by: user.employee_id,
      summary: `Stage changed from ${fromLabel} to ${toLabel}.`,
    });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'lead',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ lead: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(LEAD_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete lead.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'lead',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
