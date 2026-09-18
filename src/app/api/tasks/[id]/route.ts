// ============================================================================
// GET    /api/tasks/:id  — fetch a single task
// PATCH  /api/tasks/:id  — update a task. A manager (projects.update
//                          holder — CEO/Project Manager) can edit any field
//                          on any task in a project they can see. A plain
//                          Employee can only touch a task assigned to them,
//                          and only its status/progress/actual_hours —
//                          see db/migrations/0008_seed_projects_permissions.sql.
// DELETE /api/tasks/:id  — remove a task (manager-level only).
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
  project:projects(id, project_code, name, client_id, project_manager_id)
`;

const managerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'review', 'blocked', 'completed']).optional(),
  estimated_hours: z.number().nonnegative().optional().nullable(),
  actual_hours: z.number().nonnegative().optional(),
  completion_pct: z.number().min(0).max(100).optional(),
});

/** What a plain Employee may change on their own assigned task — progress
 *  only, never reassignment, scope, or scheduling. */
const selfUpdateSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'review', 'blocked', 'completed']).optional(),
  actual_hours: z.number().nonnegative().optional(),
  completion_pct: z.number().min(0).max(100).optional(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const db = supabaseServer();

  const { data: existing, error } = await db
    .from('project_tasks')
    .select(TASK_SELECT)
    .eq('id', id)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Task not found.' }, { status: 404 }) };
  }

  const record = existing as Record<string, any>;
  const isManagerLevel = permissions.includes(PROJECT_PERMISSIONS.UPDATE);
  const canViewAllProjects = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);

  let canView = canViewAllProjects;
  if (!canView) {
    const { data: project } = await db
      .from('projects')
      .select('project_manager_id, client:clients(account_manager_id)')
      .eq('id', record.project_id)
      .single();
    canView = project
      ? await isProjectMemberOrOwner(
          record.project_id,
          user.employee_id,
          project.project_manager_id,
          (project as any).client?.account_manager_id
        )
      : false;
  }

  const isAssignee = record.assigned_to && record.assigned_to === user.employee_id;

  return { user, db, permissions, isManagerLevel, canView, isAssignee, existing: record };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canView, existing } = ctx;

  if (!permissions.includes(TASK_PERMISSIONS.VIEW) || !canView) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ task: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, isManagerLevel, canView, isAssignee, existing } = ctx;

  if (!permissions.includes(TASK_PERMISSIONS.UPDATE) || !canView) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isManagerLevel && !isAssignee) {
    return NextResponse.json(
      { error: 'You can only update tasks assigned to you.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const schema = isManagerLevel ? managerUpdateSchema : selfUpdateSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid task data.' },
      { status: 400 }
    );
  }
  const input = parsed.data as Record<string, any>;

  if (isManagerLevel) {
    const startDate = input.start_date !== undefined ? input.start_date : existing.start_date;
    const dueDate = input.due_date !== undefined ? input.due_date : existing.due_date;
    if (dueDate && startDate && dueDate < startDate) {
      return NextResponse.json({ error: 'Due date cannot be before the start date.' }, { status: 400 });
    }
  }

  const { data: updated, error } = await db
    .from('project_tasks')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(TASK_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'task',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, isManagerLevel, canView, existing } = ctx;

  if (!permissions.includes(TASK_PERMISSIONS.DELETE) || !canView || !isManagerLevel) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db.from('project_tasks').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'task',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
