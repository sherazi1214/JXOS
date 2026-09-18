// ============================================================================
// GET  /api/contracts  — list contracts (filtered by client/status, searched
//                         by contract code, paginated)
// POST /api/contracts  — create a contract manually
//
// RBAC: contracts.view / contracts.view_all / contracts.create. A
// Salesperson without contracts.view_all only sees/creates contracts for
// clients they're the account manager for. Most contracts arrive via
// POST /api/leads/:id/convert as a draft, but manual creation is supported
// for services sold outside the CRM pipeline (e.g. a renewal or upsell).
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

const createContractSchema = z.object({
  client_id: z.string().uuid('A client is required'),
  service_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().nullable(),
  contract_value: z.number().nonnegative(),
  monthly_recurring_amt: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  payment_terms: z.string().optional().nullable(),
  renewal_terms: z.string().optional().nullable(),
  assigned_team_lead_id: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'active', 'expired', 'terminated']).optional(),
});

function generateContractCode(): string {
  return `CT-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CONTRACT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(CONTRACT_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const clientId = searchParams.get('client_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('contracts').select(CONTRACT_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (!canViewAll) {
    // Scope to contracts on clients this user is the account manager for.
    const { data: ownClients } = await db
      .from('clients')
      .select('id')
      .eq('account_manager_id', user.employee_id ?? '__none__');
    const ownClientIds = (ownClients ?? []).map((c: any) => c.id);
    query = query.in('client_id', ownClientIds.length ? ownClientIds : ['__none__']);
  } else if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('contract_code', `%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load contracts.' }, { status: 500 });
  }

  return NextResponse.json({ contracts: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CONTRACT_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(CONTRACT_PERMISSIONS.VIEW_ALL);

  const body = await req.json().catch(() => null);
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid contract data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();

  // A Salesperson without contracts.view_all may only write contracts for
  // clients they manage.
  if (!canViewAll) {
    const { data: client } = await db
      .from('clients')
      .select('account_manager_id')
      .eq('id', input.client_id)
      .single();
    if (!client || client.account_manager_id !== user.employee_id) {
      return NextResponse.json(
        { error: 'You can only create contracts for clients you manage.' },
        { status: 403 }
      );
    }
  }

  if (input.end_date && input.end_date < input.start_date) {
    return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 });
  }

  const { data: contract, error } = await db
    .from('contracts')
    .insert({
      contract_code: generateContractCode(),
      client_id: input.client_id,
      service_id: input.service_id || null,
      start_date: input.start_date,
      end_date: input.end_date || null,
      contract_value: input.contract_value,
      monthly_recurring_amt: input.monthly_recurring_amt ?? 0,
      currency: input.currency || 'USD',
      payment_terms: input.payment_terms || null,
      renewal_terms: input.renewal_terms || null,
      assigned_team_lead_id: input.assigned_team_lead_id || user.employee_id || null,
      status: input.status || 'draft',
    })
    .select(CONTRACT_SELECT)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: 'Failed to create contract.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'contract',
    entity_id: contract.id,
    new_value: contract,
  });

  return NextResponse.json({ contract }, { status: 201 });
}
