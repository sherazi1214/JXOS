// ============================================================================
// /contracts — contracts list. Server Component: real contracts.view
// permission check before handing off to the interactive contracts shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, CONTRACT_PERMISSIONS } from '@/lib/rbac';
import { ContractsPageClient } from '@/components/contracts/contracts-page-client';

export default async function ContractsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, CONTRACT_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view contracts. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <ContractsPageClient />;
}
