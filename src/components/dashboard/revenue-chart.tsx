'use client';

// ============================================================================
// RevenueChart — CEO Dashboard revenue widget: this month vs. last month
// collected revenue with growth%, outstanding receivables, and (when the
// caller also has expenses.view) this month's expenses and net profit.
// Only rendered when GET /api/dashboard returned a `revenue` section —
// i.e. the caller has invoices.view_all + payments.view.
// ============================================================================

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { formatCurrency } from '@/lib/utils';

export interface RevenueData {
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  growthPct: number | null;
  outstandingReceivables: number;
  thisMonthExpenses: number | null;
  netProfit: number | null;
  overdueInvoices: { count: number; total: number };
}

export function RevenueChart({ data }: { data: RevenueData }) {
  const growthLabel =
    data.growthPct === null
      ? 'No data last month'
      : `${data.growthPct >= 0 ? '+' : ''}${data.growthPct}% vs last month`;

  const chartData = [
    { label: 'Last Month', revenue: data.lastMonthRevenue },
    { label: 'This Month', revenue: data.thisMonthRevenue },
  ];

  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-2 ${data.netProfit !== null ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}
      >
        <StatCard
          label="Revenue This Month"
          value={formatCurrency(data.thisMonthRevenue)}
          sub={growthLabel}
          tone={data.growthPct === null || data.growthPct >= 0 ? 'success' : 'danger'}
          icon={data.growthPct !== null && data.growthPct < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
        />
        {data.netProfit !== null && (
          <StatCard
            label="Net Profit (MTD)"
            value={formatCurrency(data.netProfit)}
            sub={`Expenses ${formatCurrency(data.thisMonthExpenses ?? 0)}`}
            tone={data.netProfit >= 0 ? 'success' : 'danger'}
          />
        )}
        <StatCard
          label="Outstanding Receivables"
          value={formatCurrency(data.outstandingReceivables)}
          tone="warning"
        />
        <StatCard
          label="Overdue Invoices"
          value={String(data.overdueInvoices.count)}
          sub={data.overdueInvoices.count > 0 ? formatCurrency(data.overdueInvoices.total) : undefined}
          tone={data.overdueInvoices.count > 0 ? 'danger' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2430" vertical={false} />
              <XAxis dataKey="label" stroke="#8B93A6" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#8B93A6"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v).replace(/\.00$/, '')}
                width={80}
              />
              <Tooltip
                contentStyle={{ background: '#12161F', border: '1px solid #1F2430', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="revenue" name="Revenue" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
