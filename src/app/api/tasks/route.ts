// ============================================================================
// GET  /api/tasks  — list tasks. With ?project_id=, returns every task on
//                     that project (if you can see the project). Without
//                     it, returns tasks assigned to you — the "My Tasks"
//                     board. Managers (projects.view_all) can pass
//                     ?assigned_to= or ?mine=false to see anyone's tasks.
// POST /api/tasks  — create a task on a project.
//
// RBAC: tasks.view / tasks.create, scoped to projects.view. A plain
// Employee (no projects.update) may only self-assign a task they create;
// PROJECT_PERMISSIONS.UPDATE holders (CEO/Project Manager) can assign to
// anyone on the project. See db/migrations/0008_seed_projects_permissions.sql.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PROJECT_PERMISSIONS, TASK_PERMISSIONS } from '@/lib/rbac';
import { isProjectMemberOrOwner } from '@/lib/project-access';

const TASK_SELECT = `
  *,
  assignee:employees(id, full_name, employee_code),
  project:projects(id, project_code, name, client_id)
`;

const createTaskSchema = z.object({
  project_id: z.string().uuid('A project is required'),
  name: z.string().min(1, 'Task name is required'),
  description: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'review', 'blocked', 'completed']).optional(),
  estimated_hours: z.number().nonnegative().optional().nullable(),
});

function generateTaskCode(): string {
  return `TSK-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(TASK_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAllProjects = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assigned_to');
  const mine = searchParams.get('mine') !== 'false';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize')) || 50));

  const db = supabaseServer();
  let query = db.from('project_tasks').select(TASK_SELECT, { count: 'exact' });

  if (projectId) {
    // A specific project was asked for — anyone who can see the project
    // can see every task on it, not just their own.
    if (!canViewAllProjects) {
      const { data: project } = await db
        .from('projects')
        .select('project_manager_id, client:clients(account_manager_id)')
        .eq('id', projectId)
        .single();
      const canSee = project
        ? await isProjectMemberOrOwner(
            projectId,
            user.employee_id,
            project.project_manager_id,
            (project as any).client?.account_manager_id
          )
        : false;
      if (!canSee) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    query = query.eq('project_id', projectId);
    if (assignedTo && canViewAllProjects) query = query.eq('assigned_to', assignedTo);
  } else if (canViewAllProjects && !mine) {
    // Full task list across the company — managers only.
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
  } else if (canViewAllProjects && assignedTo) {
    query = query.eq('assigned_to', assignedTo);
  } else {
    // Default: "my tasks" — everyone without a project filter sees their
    // own assigned work, scoped by employee_id.
    query = query.eq('assigned_to', user.employee_id ?? '__none__');
  }

  if (status) query = query.eq('status', status);
  query = query.order('due_date', { ascending: true, nullsFirst: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 });
  }

  return NextResponse.json({ tasks: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(TASK_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const isManagerLevel = permissions.includes(PROJECT_PERMISSIONS.UPDATE);

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid task data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: project, error: projectError } = await db
    .from('projects')
    .select('id, project_manager_id, client:clients(account_manager_id)')
    .eq('id', input.project_id)
    .is('deleted_at', null)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const canSeeProject =
    permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL) ||
    (await isProjectMemberOrOwner(
      input.project_id,
      user.employee_id,
      project.project_manager_id,
      (project as any).client?.account_manager_id
    ));
  if (!canSeeProject) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // A plain Employee (no project management rights) can only create a task
  // assigned to themselves — this is "adding your own work item", not
  // assigning work to others.
  let assignedTo = input.assigned_to || null;
  if (!isManagerLevel) {
    assignedTo = user.employee_id;
  }

  if (input.due_date && input.start_date && input.due_date < input.start_date) {
    return NextResponse.json({ error: 'Due date cannot be before the start date.' }, { status: 400 });
  }

  const { data: task, error } = await db
    .from('project_tasks')
    .insert({
      task_code: generateTaskCode(),
      project_id: input.project_id,
      name: input.name,
      description: input.description || null,
      assigned_to: assignedTo,
      priority: input.priority || 'medium',
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      status: input.status || 'not_started',
      estimated_hours: input.estimated_hours ?? null,
    })
    .select(TASK_SELECT)
    .single();

  if (error || !task) {
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'task',
    entity_id: task.id,
    new_value: task,
  });

  return NextResponse.json({ task }, { status: 201 });
}
