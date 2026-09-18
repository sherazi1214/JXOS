// ============================================================================
// /vendors — Vendors & Subscriptions (Module 11). Server Component: real
// vendors.view permission check before handing off to the interactive shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, VENDOR_PERMISSIONS } from '@/lib/rbac';
import { VendorsPageClient } from '@/components/vendors/vendors-page-client';

export default async function VendorsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, VENDOR_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view vendors. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <VendorsPageClient />;
}
