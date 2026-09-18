// ============================================================================
// StatCard — small metric card used across the CEO Dashboard widgets.
// Same visual shape as the inline StatCard in ReportsPageClient, pulled out
// here so Revenue/Sales/Employees widgets can share it.
// ============================================================================

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'success' | 'danger' | 'warning';
  icon?: ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-white';

  return (
    <Card interactive>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted mb-1.5">{label}</p>
          <p className={cn('text-2xl font-semibold font-display', toneClass)}>{value}</p>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className="icon-tile h-9 w-9 bg-white/[0.06] text-muted">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
