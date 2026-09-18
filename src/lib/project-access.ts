// ============================================================================
// Shared scoping helpers for the Projects & Tasks module. A user without
// projects.view_all (Sales Manager, Salesperson, Employee) only sees
// projects they manage, are a member of, or whose client they
// account-manage — used by both /api/projects and /api/tasks so the two
// stay consistent (a task is visible iff its parent project is).
// ============================================================================

import { supabaseServer } from '@/lib/db';

/** Ids of projects visible to a user who lacks projects.view_all. */
export async function getScopedProjectIds(employeeId: string | null): Promise<string[]> {
  if (!employeeId) return [];
  const db = supabaseServer();

  const [{ data: managed }, { data: memberships }, { data: ownClients }] = await Promise.all([
    db.from('projects').select('id').eq('project_manager_id', employeeId).is('deleted_at', null),
    db.from('project_members').select('project_id').eq('employee_id', employeeId),
    db.from('clients').select('id').eq('account_manager_id', employeeId),
  ]);

  const ids = new Set<string>();
  (managed ?? []).forEach((p: any) => ids.add(p.id));
  (memberships ?? []).forEach((m: any) => ids.add(m.project_id));

  const ownClientIds = (ownClients ?? []).map((c: any) => c.id);
  if (ownClientIds.length) {
    const { data: clientProjects } = await db
      .from('projects')
      .select('id')
      .in('client_id', ownClientIds)
      .is('deleted_at', null);
    (clientProjects ?? []).forEach((p: any) => ids.add(p.id));
  }

  return Array.from(ids);
}

/** True if `employeeId` manages, is a member of, or account-manages the
 *  client of the given project row (shape returned by a `select` that
 *  includes `project_manager_id` and `client:clients(account_manager_id)`). */
export async function isProjectMemberOrOwner(
  projectId: string,
  employeeId: string | null,
  projectManagerId: string | null,
  clientAccountManagerId: string | null | undefined
): Promise<boolean> {
  if (!employeeId) return false;
  if (projectManagerId === employeeId) return true;
  if (clientAccountManagerId === employeeId) return true;

  const db = supabaseServer();
  const { data } = await db
    .from('project_members')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  return Boolean(data);
}
