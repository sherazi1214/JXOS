// ============================================================================
// GET    /api/projects/:id  — fetch a single project with its tasks and
//                              team members
// PATCH  /api/projects/:id  — update project fields (status, budget,
//                              revenue, cost, progress, dates, manager…)
// DELETE /api/projects/:id  — soft-delete a project
//
// RBAC: projects.view / projects.update / projects.delete. Viewing is
// scoped the same way as the list route (manager, member, or account
// manager of the client) when the caller lacks projects.view_all; editing
// and deleting stay with projects.update/delete, which are only granted to
// CEO/Admin and Project Manager (both of whom already hold view_all) — see
// db/migrations/0008_seed_projects_permissions.sql.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PROJECT_PERMISSIONS } from '@/lib/rbac';

const PROJECT_SELECT = `
  *,
  client:clients(id, company_name, client_code, account_manager_id),
  service:services(id, name),
  contract:contracts(id, contract_code),
  project_manager:employees!projects_project_manager_id_fkey(id, full_name, employee_code),
  project_tasks(*, assignee:employees(id, full_name, employee_code)),
  project_members(employee_id, role_on_project, added_at, employee:employees(id, full_name, employee_code))
`;

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  service_id: z.string().uuid().optional().nullable(),
  contract_id: z.string().uuid().optional().nullable(),
  project_manager_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1).optional(),
  deadline: z.string().optional().nullable(),
  budget: z.number().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  progress_pct: z.number().min(0).max(100).optional(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const canViewAll = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) };
  }

  const record = existing as Record<string, any>;
  const isManager = record.project_manager_id && record.project_manager_id === user.employee_id;
  const isMember = (record.project_members ?? []).some(
    (m: any) => m.employee_id === user.employee_id
  );
  const isAccountManager =
    record.client?.account_manager_id && record.client.account_manager_id === user.employee_id;

  return {
    user,
    db,
    permissions,
    canViewAll,
    canAccess: canViewAll || isManager || isMember || isAccountManager,
    isManager,
    existing: record,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, canAccess, existing } = ctx;

  if (!permissions.includes(PROJECT_PERMISSIONS.VIEW) || !canAccess) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ project: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canAccess, existing } = ctx;

  if (!permissions.includes(PROJECT_PERMISSIONS.UPDATE) || !canAccess) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid project data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const startDate = input.start_date ?? existing.start_date;
  const deadline = input.deadline !== undefined ? input.deadline : existing.deadline;
  if (deadline && deadline < startDate) {
    return NextResponse.json({ error: 'Deadline cannot be before the start date.' }, { status: 400 });
  }

  const { data: updated, error } = await db
    .from('projects')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(PROJECT_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
  }

  // Keep the manager in sync as a project member if they changed.
  if (input.project_manager_id && input.project_manager_id !== existing.project_manager_id) {
    await db
      .from('project_members')
      .upsert(
        { project_id: resolvedParams.id, employee_id: input.project_manager_id, role_on_project: 'Project Manager' },
        { onConflict: 'project_id,employee_id' }
      );
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'project',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, canAccess, existing } = ctx;

  if (!permissions.includes(PROJECT_PERMISSIONS.DELETE) || !canAccess) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'project',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
