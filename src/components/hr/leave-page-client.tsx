'use client';

// ============================================================================
// LeavePageClient — interactive shell for /hr/leave: status/employee
// filters, table, pagination, "Request Leave" modal, and the approve/reject
// detail modal. Same structure as AttendancePageClient/EmployeesPageClient.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LeaveTable, type LeaveRow } from '@/components/hr/leave-table';
import { LeaveRequestForm } from '@/components/hr/leave-request-form';
import { LeaveApprovalModal } from '@/components/hr/leave-approval-modal';
import { LEAVE_STATUSES } from '@/lib/hr-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAVE_PERMISSIONS } from '@/lib/rbac';
import type { Employee } from '@/types/database';

const PAGE_SIZE = 20;

export function LeavePageClient() {
  const { can, user, loading: authLoading } = usePermissions();

  const [requests, setRequests] = useState<LeaveRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canViewAll = can(LEAVE_PERMISSIONS.VIEW_ALL);
  const canApprove = can(LEAVE_PERMISSIONS.APPROVE);
  const canCreate = can(LEAVE_PERMISSIONS.CREATE) && Boolean(user?.employee_id);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (canViewAll && employeeId) params.set('employee_id', employeeId);

      const res = await fetch(`/api/leave?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load leave requests.');
        setRequests([]);
        setTotal(0);
        return;
      }

      setRequests(data.leave_requests ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading leave requests.');
    } finally {
      setLoading(false);
    }
  }, [page, status, employeeId, canViewAll]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setPage(1);
  }, [status, employeeId]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Leave</h1>
          <p className="text-sm text-muted mt-0.5">
            {canViewAll ? `${total} request${total === 1 ? '' : 's'}` : 'Your leave requests'}
          </p>
        </div>
        {!authLoading && canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Request Leave
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {canViewAll && (
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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

        <LeaveTable
          requests={requests}
          loading={loading}
          showEmployee={canViewAll}
          onRowClick={(request) => setSelected(request)}
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

      <LeaveRequestForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => fetchRequests()} />

      <LeaveApprovalModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={() => fetchRequests()}
        request={selected}
        canApprove={canApprove}
        canWithdraw={Boolean(selected && user?.employee_id === selected.employee_id)}
      />
    </div>
  );
}
