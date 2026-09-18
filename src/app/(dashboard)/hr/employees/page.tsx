// ============================================================================
// /hr/employees — employee roster. Server Component: real employees.view
// permission check before handing off to the interactive employees shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';
import { EmployeesPageClient } from '@/components/hr/employees-page-client';

export default async function EmployeesPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, EMPLOYEE_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view employees. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <EmployeesPageClient />;
}
