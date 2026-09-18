// ============================================================================
// /hr/attendance — attendance. Server Component: real attendance.view
// permission check before handing off to the interactive attendance shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, ATTENDANCE_PERMISSIONS } from '@/lib/rbac';
import { AttendancePageClient } from '@/components/hr/attendance-page-client';

export default async function AttendancePage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, ATTENDANCE_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view attendance. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <AttendancePageClient />;
}
