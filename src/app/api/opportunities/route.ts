// ============================================================================
// GET  /api/opportunities  — list opportunities (filtered, searched, paginated)
// POST /api/opportunities  — open a new opportunity against a lead
//
// RBAC: opportunities.view / opportunities.view_all / opportunities.create.
// Ownership is tracked directly on the opportunity (owner_id), defaulted
// from the parent lead's assignee at creation time. Reassigning an
// opportunity's owner requires leads.assign (there's no separate
// opportunities.assign permission — see rbac.ts).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, OPPORTUNITY_PERMISSIONS, LEAD_PERMISSIONS } from '@/lib/rbac';

const OPPORTUNITY_SELECT =
  '*, lead:leads(id, company_name, lead_code), owner:employees(id, full_name, employee_code)';

const createOpportunitySchema = z.object({
  lead_id: z.string().uuid('A lead is required.'),
  name: z.string().min(1, 'Opportunity name is required'),
  value: z.coerce.number().nonnegative('Value must be zero or more'),
  currency: z.string().optional(),
  probability_pct: z.coerce.number().min(0).max(100).optional(),
  expected_close_date: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(OPPORTUNITY_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(OPPORTUNITY_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const leadId = searchParams.get('lead_id');
  const ownerId = searchParams.get('owner_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('opportunities').select(OPPORTUNITY_SELECT, { count: 'exact' });

  if (!canViewAll) {
    query = query.eq('owner_id', user.employee_id ?? '__none__');
  } else if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }

  if (status) query = query.eq('status', status);
  if (leadId) query = query.eq('lead_id', leadId);
  if (search) query = query.ilike('name', `%${search}%`);

  query = query.order('expected_close_date', { ascending: true, nullsFirst: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load opportunities.' }, { status: 500 });
  }

  return NextResponse.json({ opportunities: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(OPPORTUNITY_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(OPPORTUNITY_PERMISSIONS.VIEW_ALL);
  const canAssign = permissions.includes(LEAD_PERMISSIONS.ASSIGN);

  const body = await req.json().catch(() => null);
  const parsed = createOpportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid opportunity data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('id, assigned_to')
    .eq('id', input.lead_id)
    .is('deleted_at', null)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  const isLeadOwner = lead.assigned_to && lead.assigned_to === user.employee_id;
  if (!canViewAll && !isLeadOwner) {
    return NextResponse.json(
      { error: 'You can only open opportunities on leads assigned to you.' },
      { status: 403 }
    );
  }

  const ownerId = canAssign ? input.owner_id ?? lead.assigned_to ?? user.employee_id : lead.assigned_to ?? user.employee_id;

  const { data: opportunity, error } = await db
    .from('opportunities')
    .insert({
      lead_id: input.lead_id,
      name: input.name,
      value: input.value,
      currency: input.currency || 'USD',
      probability_pct: input.probability_pct ?? 0,
      expected_close_date: input.expected_close_date || null,
      owner_id: ownerId,
    })
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error || !opportunity) {
    return NextResponse.json({ error: 'Failed to create opportunity.' }, { status: 500 });
  }

  await db.from('lead_activities').insert({
    lead_id: input.lead_id,
    activity_type: 'note',
    performed_by: user.employee_id,
    summary: `Opportunity "${input.name}" opened.`,
  });

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'opportunity',
    entity_id: opportunity.id,
    new_value: opportunity,
  });

  return NextResponse.json({ opportunity }, { status: 201 });
}
