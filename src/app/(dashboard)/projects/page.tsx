// ============================================================================
// /projects — project list. Server Component: real projects.view permission
// check before handing off to the interactive client shell, which does its
// own ownership-scoped fetch via the API.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, PROJECT_PERMISSIONS } from '@/lib/rbac';
import { ProjectsPageClient } from '@/components/projects/projects-page-client';

export default async function ProjectsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, PROJECT_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view projects. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <ProjectsPageClient />;
}
