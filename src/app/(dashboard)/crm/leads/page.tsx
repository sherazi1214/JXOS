// ============================================================================
// /crm/leads — leads list. Server Component: does the real leads.view
// permission check (the sidebar already hides the CRM link from roles that
// shouldn't see it, but that's UX only — this is the actual gate) before
// handing off to the interactive client shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, LEAD_PERMISSIONS } from '@/lib/rbac';
import { LeadsPageClient } from '@/components/crm/leads-page-client';

export default async function LeadsPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, LEAD_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view the CRM. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <LeadsPageClient />;
}
