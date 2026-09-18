'use client';

// ============================================================================
// PayrollTable — presentational table of a payroll run. Same shape as
// InvoiceTable/EmployeeTable for consistency across modules.
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
import { PAYROLL_STATUS_BADGE_VARIANT, formatPeriodMonth } from '@/lib/payroll-constants';
import { formatCurrency } from '@/lib/utils';
import type { PayrollRecord } from '@/types/database';

export interface PayrollRow extends PayrollRecord {
  employee?: { id: string; employee_code: string; full_name: string; currency?: string } | null;
  approver?: { id: string; full_name: string } | null;
}

export function PayrollTable({
  rows,
  loading,
  showEmployee,
  onRowClick,
}: {
  rows: PayrollRow[];
  loading: boolean;
  showEmployee: boolean;
  onRowClick: (row: PayrollRow) => void;
}) {
  const colSpan = showEmployee ? 7 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Period</TableHead>
          <TableHead>Base</TableHead>
          <TableHead>Commission + Bonus</TableHead>
          <TableHead>Overtime</TableHead>
          <TableHead>Net Salary</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={colSpan}>Loading payroll…</TableEmpty>
        ) : rows.length === 0 ? (
          <TableEmpty colSpan={colSpan}>No payroll records match your filters.</TableEmpty>
        ) : (
          rows.map((row) => {
            const currency = row.employee?.currency || 'USD';
            return (
              <TableRow key={row.id} onClick={() => onRowClick(row)}>
                {showEmployee && (
                  <TableCell>
                    <span className="font-medium">{row.employee?.full_name || '—'}</span>
                    <span className="block text-xs text-muted">{row.employee?.employee_code}</span>
                  </TableCell>
                )}
                <TableCell className="text-muted whitespace-nowrap">{formatPeriodMonth(row.period_month)}</TableCell>
                <TableCell className="text-muted">{formatCurrency(row.base_salary, currency)}</TableCell>
                <TableCell className="text-muted">
                  {formatCurrency(row.commission_total + row.bonus_total, currency)}
                </TableCell>
                <TableCell className="text-muted">{formatCurrency(row.overtime_pay, currency)}</TableCell>
                <TableCell className="font-medium text-white">{formatCurrency(row.net_salary, currency)}</TableCell>
                <TableCell>
                  <Badge variant={PAYROLL_STATUS_BADGE_VARIANT[row.status]}>{row.status}</Badge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
