// ============================================================================
// /clients — clients list. Server Component: real clients.view permission
// check before handing off to the interactive client shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, CLIENT_PERMISSIONS } from '@/lib/rbac';
import { ClientsPageClient } from '@/components/clients/clients-page-client';

export default async function ClientsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, CLIENT_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view clients. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <ClientsPageClient />;
}
