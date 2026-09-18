// ============================================================================
// /finance/reports — revenue/expense/P&L reports. Server Component: real
// permission check (expenses.view + invoices.view_all, the same combo the
// API enforces) before handing off to the interactive reports shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, EXPENSE_PERMISSIONS, INVOICE_PERMISSIONS } from '@/lib/rbac';
import { ReportsPageClient } from '@/components/finance/reports-page-client';

export default async function ReportsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user
    ? (await hasPermission(user.role_id, EXPENSE_PERMISSIONS.VIEW)) &&
      (await hasPermission(user.role_id, INVOICE_PERMISSIONS.VIEW_ALL))
    : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view financial reports. Contact your
          administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <ReportsPageClient />;
}
