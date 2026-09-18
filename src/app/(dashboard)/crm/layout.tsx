// ============================================================================
// CRM section layout — adds a small tab bar so Leads and Opportunities are
// reachable from within the module without needing separate top-level
// sidebar entries (the sidebar links to /crm/leads as the CRM module's
// primary destination; this covers navigation within it).
// ============================================================================

import type { ReactNode } from 'react';
import { CrmTabs } from '@/components/crm/crm-tabs';

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <CrmTabs />
      {children}
    </div>
  );
}
