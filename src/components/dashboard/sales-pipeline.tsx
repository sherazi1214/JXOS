'use client';

// ============================================================================
// SalesPipeline — CEO Dashboard sales widget: new leads, won/lost deals
// and conversion rate this month, plus open pipeline value. Only rendered
// when GET /api/dashboard returned a `sales` section — i.e. the caller has
// leads.view_all + opportunities.view_all.
// ============================================================================

import { formatCurrency, formatPercent } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';

export interface SalesData {
  newLeadsThisMonth: number;
  wonThisMonth: { count: number; value: number };
  lostThisMonth: number;
  conversionRate: number | null;
  openPipelineValue: number;
}

export function SalesPipeline({ data }: { data: SalesData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard label="New Leads (MTD)" value={String(data.newLeadsThisMonth)} />
      <StatCard
        label="Deals Won (MTD)"
        value={String(data.wonThisMonth.count)}
        sub={data.wonThisMonth.count > 0 ? formatCurrency(data.wonThisMonth.value) : undefined}
        tone="success"
      />
      <StatCard
        label="Deals Lost (MTD)"
        value={String(data.lostThisMonth)}
        tone={data.lostThisMonth > 0 ? 'danger' : undefined}
      />
      <StatCard
        label="Conversion Rate"
        value={data.conversionRate === null ? '—' : formatPercent(data.conversionRate)}
      />
      <StatCard label="Open Pipeline Value" value={formatCurrency(data.openPipelineValue)} />
    </div>
  );
}
