'use client';

// ============================================================================
// DashboardPageClient — CEO/Executive Dashboard (Module 1). Fetches
// GET /api/dashboard once and renders whichever sections came back —
// each section is only present if the signed-in role has the underlying
// module's view_all permission, so a Salesperson sees far less here than
// the CEO, without any client-side permission logic of its own.
// ============================================================================

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RevenueChart, type RevenueData } from '@/components/dashboard/revenue-chart';
import { SalesPipeline, type SalesData } from '@/components/dashboard/sales-pipeline';
import { AlertsPanel, type AlertsData } from '@/components/dashboard/alerts-panel';
import { StatCard } from '@/components/dashboard/stat-card';
import { ATTENDANCE_STATUS_BADGE_VARIANT } from '@/lib/hr-constants';
import { capitalize } from '@/lib/utils';

interface ClientsData {
  activeClients: number;
  newClientsThisMonth: number;
}

interface AttendanceTally {
  present: number;
  late: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
  checkedIn: number;
  notYetMarked: number;
}

interface EmployeesData {
  totalActive: number;
  attendanceToday: AttendanceTally | null;
}

interface DashboardResponse {
  revenue: RevenueData | null;
  sales: SalesData | null;
  clients: ClientsData | null;
  employees: EmployeesData | null;
  alerts: AlertsData;
}

export function DashboardPageClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dashboard')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load dashboard data.');
        return body as DashboardResponse;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nothingVisible =
    data && !data.revenue && !data.sales && !data.clients && !data.employees;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-brand-gradient-soft px-5 py-5 animate-fade-in-up">
        <div className="aurora-blob -top-10 -right-10 h-40 w-40 bg-primary/20" />
        <div className="relative">
          <h1 className="font-display text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">Company health at a glance</p>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">{errorMsg}</p>}

      {loading && !data && (
        <Card>
          <p className="text-sm text-muted">Loading dashboard…</p>
        </Card>
      )}

      {data && nothingVisible && (
        <Card>
          <p className="text-sm text-muted">
            Your role doesn&apos;t have visibility into company-wide metrics yet. Check the CRM,
            Clients or HR sections for what you can see.
          </p>
        </Card>
      )}

      {data?.revenue && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Finance</h2>
          <RevenueChart data={data.revenue} />
        </section>
      )}

      {data?.sales && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Sales</h2>
          <SalesPipeline data={data.sales} />
        </section>
      )}

      {(data?.clients || data?.employees) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Clients &amp; Team</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.clients && (
              <>
                <StatCard label="Active Clients" value={String(data.clients.activeClients)} />
                <StatCard
                  label="New Clients (MTD)"
                  value={String(data.clients.newClientsThisMonth)}
                  tone={data.clients.newClientsThisMonth > 0 ? 'success' : undefined}
                />
              </>
            )}
            {data?.employees && (
              <>
                <StatCard
                  label="Active Employees"
                  value={String(data.employees.totalActive)}
                  icon={<Users size={18} />}
                />
                {data.employees.attendanceToday && (
                  <StatCard
                    label="Checked In Today"
                    value={`${data.employees.attendanceToday.checkedIn}/${data.employees.totalActive}`}
                    sub={
                      data.employees.attendanceToday.late > 0
                        ? `${data.employees.attendanceToday.late} late`
                        : undefined
                    }
                    tone={data.employees.attendanceToday.late > 0 ? 'warning' : 'success'}
                  />
                )}
              </>
            )}
          </div>

          {data?.employees?.attendanceToday && (
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Attendance Breakdown</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {(['present', 'late', 'absent', 'half_day', 'leave', 'holiday'] as const).map((status) => {
                  const count = data.employees!.attendanceToday![status];
                  if (!count) return null;
                  return (
                    <Badge key={status} variant={ATTENDANCE_STATUS_BADGE_VARIANT[status]}>
                      {count} {capitalize(status.replace('_', ' '))}
                    </Badge>
                  );
                })}
                {data.employees.attendanceToday.notYetMarked > 0 && (
                  <Badge variant="muted">{data.employees.attendanceToday.notYetMarked} Not Marked</Badge>
                )}
              </div>
            </Card>
          )}
        </section>
      )}

      {data && (data.alerts.overdueInvoices || data.alerts.expiringContracts || data.alerts.followUpsDue) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Alerts</h2>
          <AlertsPanel data={data.alerts} />
        </section>
      )}
    </div>
  );
}
