// ============================================================================
// GET  /api/projects  — list projects (filtered by client/status/priority,
//                        searched by project code/name, paginated)
// POST /api/projects  — create a project manually (most will eventually
//                        arrive as a draft via a won opportunity/contract;
//                        this covers manual creation for now)
//
// RBAC: projects.view / projects.view_all / projects.create. Without
// projects.view_all (Sales Manager, Salesperson, Employee), a user only
// sees projects where they are the project manager, a project member, or
// the account manager of the project's client — enforced here on the
// server, same pattern as /api/contracts.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PROJECT_PERMISSIONS } from '@/lib/rbac';
import { getScopedProjectIds } from '@/lib/project-access';

const PROJECT_SELECT = `
  *,
  client:clients(id, company_name, client_code, account_manager_id),
  service:services(id, name),
  project_manager:employees!projects_project_manager_id_fkey(id, full_name, employee_code)
`;

const createProjectSchema = z.object({
  client_id: z.string().uuid('A client is required'),
  service_id: z.string().uuid().optional().nullable(),
  contract_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Project name is required'),
  project_manager_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  deadline: z.string().optional().nullable(),
  budget: z.number().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

function generateProjectCode(): string {
  return `PRJ-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PROJECT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const clientId = searchParams.get('client_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('projects').select(PROJECT_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (!canViewAll) {
    const scopedIds = await getScopedProjectIds(user.employee_id);
    query = query.in('id', scopedIds.length ? scopedIds : ['__none__']);
  } else if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`project_code.ilike.%${search}%,name.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
  }

  return NextResponse.json({ projects: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PROJECT_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid project data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.deadline && input.deadline < input.start_date) {
    return NextResponse.json({ error: 'Deadline cannot be before the start date.' }, { status: 400 });
  }

  const db = supabaseServer();
  const { data: project, error } = await db
    .from('projects')
    .insert({
      project_code: generateProjectCode(),
      client_id: input.client_id,
      service_id: input.service_id || null,
      contract_id: input.contract_id || null,
      name: input.name,
      project_manager_id: input.project_manager_id || user.employee_id || null,
      start_date: input.start_date,
      deadline: input.deadline || null,
      budget: input.budget ?? 0,
      revenue: input.revenue ?? 0,
      cost: input.cost ?? 0,
      status: input.status || 'planning',
      priority: input.priority || 'medium',
    })
    .select(PROJECT_SELECT)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
  }

  // The project manager is automatically a project member so they show up
  // in team listings and can see the project via membership too.
  if (project.project_manager_id) {
    await db.from('project_members').insert({
      project_id: project.id,
      employee_id: project.project_manager_id,
      role_on_project: 'Project Manager',
    });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'project',
    entity_id: project.id,
    new_value: project,
  });

  return NextResponse.json({ project }, { status: 201 });
}
