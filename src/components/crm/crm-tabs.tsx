'use client';

// ============================================================================
// CrmTabs — small in-section tab bar for switching between Leads and
// Opportunities within the CRM module (see crm/layout.tsx).
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Leads', href: '/crm/leads' },
  { label: 'Opportunities', href: '/crm/opportunities' },
];

export function CrmTabs() {
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
