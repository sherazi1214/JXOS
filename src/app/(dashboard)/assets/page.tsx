// ============================================================================
// /assets — Assets & IT (Module 12). Server Component: real assets.view
// permission check before handing off to the interactive shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, ASSET_PERMISSIONS } from '@/lib/rbac';
import { AssetsPageClient } from '@/components/assets/assets-page-client';

export default async function AssetsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, ASSET_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view assets. Contact your administrator if you
          believe this is a mistake.
        </p>
      </div>
    );
  }

  return <AssetsPageClient />;
}
