// ============================================================================
// GET  /api/clients  — list clients (filtered, searched, paginated)
// POST /api/clients  — create a client manually
//
// RBAC: clients.view / clients.view_all / clients.create. A Salesperson
// without clients.view_all only ever sees/creates clients they're the
// account manager for. Most clients will actually arrive via
// POST /api/leads/:id/convert rather than this endpoint directly, but
// manual creation is supported for clients that never went through the
// CRM pipeline.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const CLIENT_SELECT = '*, account_manager:employees(id, full_name, employee_code)';

const createClientSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  country: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  account_manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive', 'churned']).optional(),
  client_since: z.string().optional(),
  notes: z.string().optional().nullable(),
});

function generateClientCode(): string {
  return `CL-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CLIENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(CLIENT_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const accountManagerId = searchParams.get('account_manager_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('clients').select(CLIENT_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (!canViewAll) {
    query = query.eq('account_manager_id', user.employee_id ?? '__none__');
  } else if (accountManagerId) {
    query = query.eq('account_manager_id', accountManagerId);
  }

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('company_name', `%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load clients.' }, { status: 500 });
  }

  return NextResponse.json({ clients: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CLIENT_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canAssign = permissions.includes(CLIENT_PERMISSIONS.ASSIGN);

  const body = await req.json().catch(() => null);
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid client data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const accountManagerId = canAssign
    ? input.account_manager_id ?? user.employee_id ?? null
    : user.employee_id ?? null;

  const db = supabaseServer();
  const { data: client, error } = await db
    .from('clients')
    .insert({
      client_code: generateClientCode(),
      company_name: input.company_name,
      country: input.country || null,
      industry: input.industry || null,
      account_manager_id: accountManagerId,
      status: input.status || 'active',
      client_since: input.client_since || new Date().toISOString().slice(0, 10),
      notes: input.notes || null,
    })
    .select(CLIENT_SELECT)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: 'Failed to create client.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'client',
    entity_id: client.id,
    new_value: client,
  });

  return NextResponse.json({ client }, { status: 201 });
}
