// ============================================================================
// POST /api/projects/:id/members  — add an employee to a project's team
//
// RBAC: projects.update, scoped like PATCH /api/projects/:id. Membership is
// what unlocks projects.view + tasks.view for an Employee without
// projects.view_all, so adding someone here is effectively granting them
// visibility into the project.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PROJECT_PERMISSIONS } from '@/lib/rbac';

const addMemberSchema = z.object({
  employee_id: z.string().uuid('Pick an employee.'),
  role_on_project: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PROJECT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { data: project, error: projectError } = await db
    .from('projects')
    .select('id, project_manager_id, client:clients(account_manager_id)')
    .eq('id', resolvedParams.id)
    .is('deleted_at', null)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const canViewAll = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);
  const isManager = project.project_manager_id === user.employee_id;
  if (!canViewAll && !isManager) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid data.' },
      { status: 400 }
    );
  }

  const { data: member, error } = await db
    .from('project_members')
    .insert({
      project_id: resolvedParams.id,
      employee_id: parsed.data.employee_id,
      role_on_project: parsed.data.role_on_project || null,
    })
    .select('*, employee:employees(id, full_name, employee_code)')
    .single();

  if (error || !member) {
    return NextResponse.json(
      {
        error:
          (error as any)?.code === '23505'
            ? 'This employee is already on the project.'
            : 'Failed to add team member.',
      },
      { status: (error as any)?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ member }, { status: 201 });
}
