// ============================================================================
// /dashboard — CEO/Executive Dashboard (Module 1). The (dashboard) layout
// already enforces the session check before this page ever renders, so
// there's nothing further to gate here — unlike other pages, there's no
// single "dashboard.view" permission either; each widget gates itself on
// the permission for the module it summarizes (see GET /api/dashboard).
// ============================================================================

import { DashboardPageClient } from '@/components/dashboard/dashboard-page-client';

export default function DashboardPage() {
  return <DashboardPageClient />;
}
