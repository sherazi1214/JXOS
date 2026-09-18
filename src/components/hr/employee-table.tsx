'use client';

// ============================================================================
// EmployeeTable — presentational table of the employee roster. Same shape
// as InvoiceTable/ExpenseTable for consistency across modules.
// ============================================================================

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EMPLOYEE_STATUS_BADGE_VARIANT, EMPLOYMENT_TYPES } from '@/lib/hr-constants';
import { formatDate } from '@/lib/utils';
import type { Employee } from '@/types/database';

export interface EmployeeRow extends Employee {
  department?: { id: string; name: string } | null;
  manager?: { id: string; full_name: string; employee_code?: string } | null;
}

function employmentTypeLabel(value: Employee['employment_type']): string {
  return EMPLOYMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function EmployeeTable({
  employees,
  loading,
  onRowClick,
}: {
  employees: EmployeeRow[];
  loading: boolean;
  onRowClick: (employee: EmployeeRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={6}>Loading employees…</TableEmpty>
        ) : employees.length === 0 ? (
          <TableEmpty colSpan={6}>No employees match your filters.</TableEmpty>
        ) : (
          employees.map((employee) => (
            <TableRow key={employee.id} onClick={() => onRowClick(employee)}>
              <TableCell>
                <span className="font-medium">{employee.full_name}</span>
                <span className="block text-xs text-muted">{employee.employee_code}</span>
              </TableCell>
              <TableCell className="text-muted">{employee.department?.name || '—'}</TableCell>
              <TableCell className="text-muted">{employee.designation || '—'}</TableCell>
              <TableCell className="text-muted">{employmentTypeLabel(employee.employment_type)}</TableCell>
              <TableCell className="text-muted whitespace-nowrap">
                {formatDate(employee.joining_date)}
              </TableCell>
              <TableCell>
                <Badge variant={EMPLOYEE_STATUS_BADGE_VARIANT[employee.status]}>
                  {employee.status.replace('_', ' ')}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
