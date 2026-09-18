'use client';

// ============================================================================
// AttendancePageClient — interactive shell for /hr/attendance: the
// self-service check-in widget up top (if this account is linked to an
// employee), then date-range/status/employee filters, the records table,
// pagination, and the HR correction modal. Same structure as
// EmployeesPageClient/InvoicesPageClient for consistency.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AttendanceWidget } from '@/components/hr/attendance-widget';
import { AttendanceTable, type AttendanceRow } from '@/components/hr/attendance-table';
import { AttendanceCorrectionForm } from '@/components/hr/attendance-correction-form';
import { ATTENDANCE_STATUSES } from '@/lib/hr-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { ATTENDANCE_PERMISSIONS } from '@/lib/rbac';
import type { Employee } from '@/types/database';

const PAGE_SIZE = 30;

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePageClient() {
  const { can, user, loading: authLoading } = usePermissions();

  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayDate());
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canViewAll = can(ATTENDANCE_PERMISSIONS.VIEW_ALL);
  const canUpdate = can(ATTENDANCE_PERMISSIONS.UPDATE);
  const canCheckIn = can(ATTENDANCE_PERMISSIONS.CHECK_IN) && Boolean(user?.employee_id);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (status) params.set('status', status);
      if (canViewAll && employeeId) params.set('employee_id', employeeId);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load attendance.');
        setRecords([]);
        setTotal(0);
        return;
      }

      setRecords(data.attendance ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading attendance.');
    } finally {
      setLoading(false);
    }
  }, [page, from, to, status, employeeId, canViewAll]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [from, to, status, employeeId]);

  useEffect(() => {
    if (!canViewAll) return;
    fetch('/api/employees?pageSize=200')
      .then((res) => (res.ok ? res.json() : { employees: [] }))
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => setEmployees([]));
  }, [canViewAll]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inputClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Attendance</h1>
        <p className="text-sm text-muted mt-0.5">
          {canViewAll ? `${total} record${total === 1 ? '' : 's'}` : 'Your attendance history'}
        </p>
      </div>

      {!authLoading && canCheckIn && <AttendanceWidget onChanged={fetchRecords} />}

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">From</label>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">To</label>
            <input
              type="date"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {canViewAll && (
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code})
                </option>
              ))}
            </select>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <AttendanceTable
          records={records}
          loading={loading}
          showEmployee={canViewAll}
          onRowClick={canUpdate ? (record) => setEditing(record) : undefined}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {canUpdate && (
        <AttendanceCorrectionForm
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => fetchRecords()}
          record={editing}
        />
      )}
    </div>
  );
}
