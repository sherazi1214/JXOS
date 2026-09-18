// ============================================================================
// /crm/opportunities — opportunities list. Server Component: real
// opportunities.view permission check before handing off to the
// interactive client shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, OPPORTUNITY_PERMISSIONS } from '@/lib/rbac';
import { OpportunitiesPageClient } from '@/components/crm/opportunities-page-client';

export default async function OpportunitiesPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, OPPORTUNITY_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view opportunities. Contact your
          administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <OpportunitiesPageClient />;
}
