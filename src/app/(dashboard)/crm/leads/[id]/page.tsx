// ============================================================================
// /crm/leads/:id — single lead detail. Server Component: same real
// leads.view permission check as the list page, before handing off to the
// interactive client shell (which does its own ownership-scoped fetch of
// the lead via the API and will show a clean "not found/forbidden" state
// for a Salesperson trying to open a lead assigned to someone else).
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, LEAD_PERMISSIONS } from '@/lib/rbac';
import { LeadDetailClient } from '@/components/crm/lead-detail-client';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
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

  return <LeadDetailClient leadId={resolvedParams.id} />;
}
