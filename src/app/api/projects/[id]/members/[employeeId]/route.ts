// ============================================================================
// DELETE /api/projects/:id/members/:employeeId  — remove an employee from a
//                                                   project's team
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PROJECT_PERMISSIONS } from '@/lib/rbac';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PROJECT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { data: project } = await db
    .from('projects')
    .select('id, project_manager_id')
    .eq('id', resolvedParams.id)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const canViewAll = permissions.includes(PROJECT_PERMISSIONS.VIEW_ALL);
  if (!canViewAll && project.project_manager_id !== user.employee_id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (resolvedParams.employeeId === project.project_manager_id) {
    return NextResponse.json(
      { error: 'Reassign the project manager before removing them from the team.' },
      { status: 400 }
    );
  }

  const { error } = await db
    .from('project_members')
    .delete()
    .eq('project_id', resolvedParams.id)
    .eq('employee_id', resolvedParams.employeeId);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove team member.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
