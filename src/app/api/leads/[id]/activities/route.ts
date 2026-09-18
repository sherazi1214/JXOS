// ============================================================================
// GET  /api/leads/:id/activities  — activity timeline for a lead
// POST /api/leads/:id/activities  — log a call/email/note/follow-up etc.
//
// Logging an activity also bumps last_contact_at on the lead, and — when
// the activity is a follow_up carrying next_follow_up_at — updates the
// lead's next scheduled follow-up so it surfaces correctly on dashboards.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, LEAD_PERMISSIONS } from '@/lib/rbac';

const ACTIVITY_SELECT = '*, performed_by_employee:employees(id, full_name)';

const createActivitySchema = z.object({
  activity_type: z.enum(['call', 'email', 'whatsapp', 'meeting', 'note', 'follow_up', 'proposal', 'status_change']),
  summary: z.string().min(1, 'Please add a note describing this activity.'),
  occurred_at: z.string().optional(),
  next_follow_up_at: z.string().optional().nullable(),
});

async function loadLeadForAccessCheck(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(LEAD_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: lead, error } = await db
    .from('leads')
    .select('id, assigned_to')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !lead) {
    return { error: NextResponse.json({ error: 'Lead not found.' }, { status: 404 }) };
  }

  const isOwner = lead.assigned_to && lead.assigned_to === user.employee_id;
  return { user, db, permissions, canViewAll, isOwner, lead };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadLeadForAccessCheck(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { db, permissions, canViewAll, isOwner } = ctx;

  if (!permissions.includes(LEAD_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { data, error } = await db
    .from('lead_activities')
    .select(ACTIVITY_SELECT)
    .eq('lead_id', resolvedParams.id)
    .order('occurred_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load activities.' }, { status: 500 });
  }

  return NextResponse.json({ activities: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadLeadForAccessCheck(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canViewAll, isOwner } = ctx;

  if (!permissions.includes(LEAD_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json(
      { error: 'You can only log activity on leads assigned to you.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid activity data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data: activity, error } = await db
    .from('lead_activities')
    .insert({
      lead_id: resolvedParams.id,
      activity_type: input.activity_type,
      performed_by: user.employee_id,
      summary: input.summary,
      occurred_at: input.occurred_at || new Date().toISOString(),
    })
    .select(ACTIVITY_SELECT)
    .single();

  if (error || !activity) {
    return NextResponse.json({ error: 'Failed to log activity.' }, { status: 500 });
  }

  const leadUpdates: Record<string, any> = {
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.activity_type === 'follow_up' && input.next_follow_up_at) {
    leadUpdates.next_follow_up_at = input.next_follow_up_at;
  }
  await db.from('leads').update(leadUpdates).eq('id', resolvedParams.id);

  return NextResponse.json({ activity }, { status: 201 });
}
