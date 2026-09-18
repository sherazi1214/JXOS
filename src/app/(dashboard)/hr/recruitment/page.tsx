// ============================================================================
// /hr/recruitment — candidate pipeline. Server Component: real
// recruitment.view permission check before handing off to the interactive
// recruitment shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, RECRUITMENT_PERMISSIONS } from '@/lib/rbac';
import { RecruitmentPageClient } from '@/components/recruitment/recruitment-page-client';

export default async function RecruitmentPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, RECRUITMENT_PERMISSIONS.VIEW) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to view recruitment. Contact your administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <RecruitmentPageClient />;
}
