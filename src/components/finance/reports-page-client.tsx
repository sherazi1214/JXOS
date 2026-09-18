'use client';

// ============================================================================
// ReportsPageClient — Finance reports: revenue vs. expense trend, P&L
// totals, outstanding receivables, and an expense breakdown by category.
// Pulls everything from GET /api/reports/finance?months=N in one call.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface MonthRow {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  invoiced: number;
  profit: number;
}

interface CategoryRow {
  name: string;
  amount: number;
}

interface ReportData {
  months: MonthRow[];
  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    invoiced: number;
    outstandingReceivables: number;
  };
  expenseByCategory: CategoryRow[];
}

const RANGE_OPTIONS = [
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
  { label: '12 Months', value: 12 },
];

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warning';
}) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-white';
  return (
    <Card>
      <p className="text-xs text-muted mb-1.5">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </Card>
  );
}

export function ReportsPageClient() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    fetch(`/api/reports/finance?months=${months}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load report data.');
        return body as ReportData;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load report data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [months]);

  const maxCategoryAmount = Math.max(1, ...(data?.expenseByCategory.map((c) => c.amount) ?? [0]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Financial Reports</h1>
          <p className="text-sm text-muted mt-0.5">Revenue, expenses and profitability at a glance</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMonths(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                months === opt.value ? 'bg-primary text-white' : 'text-muted hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">{errorMsg}</p>
      )}

      {loading && !data ? (
        <Card>
          <p className="text-sm text-muted">Loading report…</p>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={`Revenue (${months}mo)`} value={formatCurrency(data.totals.revenue)} tone="success" />
            <StatCard label={`Expenses (${months}mo)`} value={formatCurrency(data.totals.expenses)} tone="danger" />
            <StatCard
              label="Net Profit"
              value={formatCurrency(data.totals.profit)}
              tone={data.totals.profit >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Outstanding Receivables"
              value={formatCurrency(data.totals.outstandingReceivables)}
              tone="warning"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue vs. Expenses</CardTitle>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8B93A6' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Biggest Expense Categories</CardTitle>
            </CardHeader>
            {data.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted">No expenses logged in this range.</p>
            ) : (
              <div className="space-y-3">
                {data.expenseByCategory.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-white">{cat.name}</span>
                      <span className="text-muted">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(cat.amount / maxCategoryAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
