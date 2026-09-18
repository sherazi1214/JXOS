'use client';

// ============================================================================
// EmployeesPageClient — interactive shell for /hr/employees: search +
// department/status filters, table, pagination, "Add Employee" modal. Same
// structure as InvoicesPageClient/ExpensesPageClient for consistency.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmployeeTable, type EmployeeRow } from '@/components/hr/employee-table';
import { EmployeeForm } from '@/components/hr/employee-form';
import { EMPLOYEE_STATUSES } from '@/lib/hr-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { EMPLOYEE_PERMISSIONS } from '@/lib/rbac';
import type { Department } from '@/types/database';

const PAGE_SIZE = 20;

export function EmployeesPageClient() {
  const { can, loading: authLoading } = usePermissions();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canViewAll = can(EMPLOYEE_PERMISSIONS.VIEW_ALL);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (departmentId) params.set('department_id', departmentId);
      if (status) params.set('status', status);

      const res = await fetch(`/api/employees?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load employees.');
        setEmployees([]);
        setTotal(0);
        return;
      }

      setEmployees(data.employees ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading employees.');
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentId, status]);

  useEffect(() => {
    const timeout = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timeout);
  }, [fetchEmployees]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentId, status]);

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Employees</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} employee{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && can(EMPLOYEE_PERMISSIONS.CREATE) && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            Add Employee
          </Button>
        )}
      </div>

      <Card>
        {canViewAll && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search name, email, code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
            />
            <select className={selectClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <EmployeeTable
          employees={employees}
          loading={loading}
          onRowClick={(employee) => {
            if (!can(EMPLOYEE_PERMISSIONS.UPDATE)) return;
            setEditing(employee);
            setFormOpen(true);
          }}
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

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchEmployees()}
        employee={editing}
      />
    </div>
  );
}
