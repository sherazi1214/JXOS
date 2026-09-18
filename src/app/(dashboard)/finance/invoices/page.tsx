// ============================================================================
// /finance/invoices — invoices list. Server Component: real invoices.view
// permission check before handing off to the interactive invoices shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, INVOICE_PERMISSIONS } from '@/lib/rbac';
import { InvoicesPageClient } from '@/components/finance/invoices-page-client';

export default async function InvoicesPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user
    ? (await hasPermission(user.role_id, INVOICE_PERMISSIONS.VIEW)) &&
      (await hasPermission(user.role_id, INVOICE_PERMISSIONS.VIEW_ALL))
    : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view invoices. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <InvoicesPageClient />;
}
