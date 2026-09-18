// ============================================================================
// /projects/tasks — My Tasks board. Server Component: real tasks.view
// permission check before handing off to the interactive client shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, TASK_PERMISSIONS } from '@/lib/rbac';
import { TasksPageClient } from '@/components/projects/tasks-page-client';

export default async function ProjectTasksPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, TASK_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view tasks. Contact your administrator if you
          believe this is a mistake.
        </p>
      </div>
    );
  }

  return <TasksPageClient />;
}
