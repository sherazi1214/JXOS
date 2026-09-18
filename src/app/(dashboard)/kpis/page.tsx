// ============================================================================
// /kpis — Company Goals & KPI System (Module 13). Server Component: real
// kpis.view permission check before handing off to the interactive shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, KPI_PERMISSIONS } from '@/lib/rbac';
import { KpisPageClient } from '@/components/kpis/kpis-page-client';

export default async function KpisPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, KPI_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view company KPIs. Contact your administrator
          if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <KpisPageClient />;
}
