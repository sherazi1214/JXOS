// ============================================================================
// /payroll — Payroll & Compensation (Module 10). Server Component: real
// payroll.view permission check before handing off to the interactive shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, PAYROLL_PERMISSIONS } from '@/lib/rbac';
import { PayrollPageClient } from '@/components/payroll/payroll-page-client';

export default async function PayrollPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, PAYROLL_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view payroll. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <PayrollPageClient />;
}
