// ============================================================================
// GET  /api/leads   — list leads (filtered, searched, paginated)
// POST /api/leads   — create a lead
//
// RBAC: leads.view / leads.view_all / leads.create (see src/lib/rbac.ts).
// A Salesperson without leads.view_all only ever sees/creates leads
// assigned to themselves — enforced here on the server, not just hidden
// in the UI.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, LEAD_PERMISSIONS } from '@/lib/rbac';

const LEAD_SELECT = '*, assigned_employee:employees(id, full_name, employee_code)';

const createLeadSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_person: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  source: z.string().min(1, 'Source is required'),
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

function generateLeadCode(): string {
  return `LD-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(LEAD_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(LEAD_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const stage = searchParams.get('stage');
  const priority = searchParams.get('priority');
  const source = searchParams.get('source');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));
  const sort = searchParams.get('sort'); // 'follow_up' | default = newest first

  const db = supabaseServer();
  let query = db.from('leads').select(LEAD_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (!canViewAll) {
    // A salesperson without leads.view_all only ever sees their own leads,
    // regardless of any assigned_to filter they might pass.
    query = query.eq('assigned_to', user.employee_id ?? '__none__');
  } else if (assignedTo) {
    query = query.eq('assigned_to', assignedTo);
  }

  if (stage) query = query.eq('stage', stage);
  if (priority) query = query.eq('priority', priority);
  if (source) query = query.eq('source', source);
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  query =
    sort === 'follow_up'
      ? query.order('next_follow_up_at', { ascending: true, nullsFirst: false })
      : query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load leads.' }, { status: 500 });
  }

  return NextResponse.json({
    leads: data,
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(LEAD_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canAssign = permissions.includes(LEAD_PERMISSIONS.ASSIGN);

  const body = await req.json().catch(() => null);
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid lead data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Only leads.assign holders may hand a lead to someone else. Everyone
  // else's new leads land on themselves (or unassigned, if they're not
  // staff — shouldn't normally happen for CRM roles).
  const assignedTo = canAssign ? input.assigned_to ?? user.employee_id ?? null : user.employee_id ?? null;

  const db = supabaseServer();
  const { data: lead, error } = await db
    .from('leads')
    .insert({
      lead_code: generateLeadCode(),
      company_name: input.company_name,
      contact_person: input.contact_person || null,
      email: input.email || null,
      phone: input.phone || null,
      country: input.country || null,
      city: input.city || null,
      industry: input.industry || null,
      website: input.website || null,
      source: input.source,
      campaign: input.campaign || null,
      service_interested: input.service_interested || null,
      lead_value: input.lead_value ?? null,
      currency: input.currency || 'USD',
      stage: input.stage || 'new',
      priority: input.priority || 'medium',
      assigned_to: assignedTo,
      next_follow_up_at: input.next_follow_up_at || null,
      notes: input.notes || null,
    })
    .select(LEAD_SELECT)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: 'Failed to create lead.' }, { status: 500 });
  }

  await db.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'note',
    performed_by: user.employee_id,
    summary: `Lead created via ${input.source}.`,
  });

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'lead',
    entity_id: lead.id,
    new_value: lead,
  });

  return NextResponse.json({ lead }, { status: 201 });
}
