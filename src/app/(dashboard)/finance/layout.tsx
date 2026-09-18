// ============================================================================
// Finance section layout — adds a small tab bar so Invoices, Expenses and
// Reports are reachable from within the module without separate top-level
// sidebar entries (the sidebar links to /finance/invoices as the Finance
// module's primary destination; this covers navigation within it).
// Same pattern as crm/layout.tsx.
// ============================================================================

import type { ReactNode } from 'react';
import { FinanceTabs } from '@/components/finance/finance-tabs';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <FinanceTabs />
      {children}
    </div>
  );
}
