// ============================================================================
// /finance/payments — company-wide payment ledger (Module 7). Server
// Component: real payments.view permission check before handing off to the
// interactive shell. Recording a new payment happens against the specific
// invoice it settles (see the Invoices page); this page is the read view
// across all of them.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, PAYMENT_PERMISSIONS } from '@/lib/rbac';
import { PaymentsPageClient } from '@/components/finance/payments-page-client';

export default async function PaymentsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, PAYMENT_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view payments. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <PaymentsPageClient />;
}
