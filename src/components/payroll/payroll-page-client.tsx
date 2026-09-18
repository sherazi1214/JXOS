'use client';

// ============================================================================
// PayrollPageClient — interactive shell for /payroll: period picker,
// "Generate Payroll" (payroll.generate) which POSTs to /api/payroll, and
// per-row Approve/Lock actions (payroll.approve) via PATCH /api/payroll/:id.
// Uses the existing PayrollTable for the row layout.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { PayrollTable, type PayrollRow } from '@/components/payroll/payroll-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PAYROLL_PERMISSIONS } from '@/lib/rbac';
import { periodMonthKey, formatPeriodMonth } from '@/lib/payroll-constants';
import { formatCurrency } from '@/lib/utils';

const inputClass =
  'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

export function PayrollPageClient() {
  const { can, loading: authLoading } = usePermissions();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(periodMonthKey());
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<PayrollRow | null>(null);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period_month: period, pageSize: '100' });
      const res = await fetch(`/api/payroll?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load payroll.');
        return;
      }
      setRows(data.payroll ?? []);
    } catch {
      setErrorMsg('Network error while loading payroll.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  async function handleGenerate() {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_month: period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate payroll.');
        return;
      }
      fetchPayroll();
    } catch {
      setErrorMsg('Network error while generating payroll.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleTransition(status: 'approved' | 'locked') {
    if (!selected) return;
    try {
      const res = await fetch(`/api/payroll/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update payroll record.');
        return;
      }
      setSelected(null);
      fetchPayroll();
    } catch {
      setErrorMsg('Network error while updating the payroll record.');
    }
  }

  const totalNet = rows.reduce((s, r) => s + Number(r.net_salary), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Payroll &amp; Compensation</h1>
          <p className="text-sm text-muted mt-0.5">
            {formatPeriodMonth(period)} · {rows.length} record{rows.length === 1 ? '' : 's'} · Total net {formatCurrency(totalNet)}
          </p>
        </div>
        {!authLoading && can(PAYROLL_PERMISSIONS.GENERATE) && (
          <Button onClick={handleGenerate} loading={generating}>
            <Play size={16} />
            Generate Payroll
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="month"
            className={inputClass}
            value={period.slice(0, 7)}
            onChange={(e) => setPeriod(`${e.target.value}-01`)}
          />
        </div>

        <PayrollTable
          rows={rows}
          loading={loading}
          showEmployee={can(PAYROLL_PERMISSIONS.VIEW_ALL)}
          onRowClick={(row) => setSelected(row)}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.employee?.full_name ? `Payroll — ${selected.employee.full_name}` : 'Payroll Record'}
        footer={
          selected && can(PAYROLL_PERMISSIONS.APPROVE) && selected.status !== 'locked' ? (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
              {selected.status === 'draft' && <Button onClick={() => handleTransition('approved')}>Approve</Button>}
              {selected.status === 'approved' && <Button onClick={() => handleTransition('locked')}>Lock</Button>}
            </>
          ) : (
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-2 text-sm">
            <Row label="Period" value={formatPeriodMonth(selected.period_month)} />
            <Row label="Base Salary" value={formatCurrency(selected.base_salary, selected.employee?.currency)} />
            <Row label="Commission" value={formatCurrency(selected.commission_total, selected.employee?.currency)} />
            <Row label="Bonus" value={formatCurrency(selected.bonus_total, selected.employee?.currency)} />
            <Row label="Overtime" value={formatCurrency(selected.overtime_pay, selected.employee?.currency)} />
            <Row label="Deductions" value={formatCurrency(selected.deductions, selected.employee?.currency)} />
            <Row label="Net Salary" value={formatCurrency(selected.net_salary, selected.employee?.currency)} bold />
            <Row label="Status" value={selected.status} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5">
      <span className="text-muted">{label}</span>
      <span className={bold ? 'font-semibold text-white' : 'text-white'}>{value}</span>
    </div>
  );
}
