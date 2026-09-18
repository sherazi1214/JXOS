'use client';

// ============================================================================
// FinanceTabs — small in-section tab bar for switching between Invoices,
// Expenses and Reports within the Finance module (see finance/layout.tsx).
// Same pattern as CrmTabs.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Invoices', href: '/finance/invoices' },
  { label: 'Expenses', href: '/finance/expenses' },
  { label: 'Reports', href: '/finance/reports' },
];

export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-white'
                : 'border-transparent text-muted hover:text-white'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
