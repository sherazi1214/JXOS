'use client';

// ============================================================================
// LeaveTable — presentational table of leave requests. Same shape as
// AttendanceTable/EmployeeTable for consistency across HR modules.
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
import { LEAVE_STATUS_BADGE_VARIANT, LEAVE_TYPES } from '@/lib/hr-constants';
import { formatDate } from '@/lib/utils';
import type { LeaveRequest } from '@/types/database';

export interface LeaveRow extends LeaveRequest {
  employee?: { id: string; full_name: string; employee_code: string } | null;
  approver?: { id: string; full_name: string } | null;
  reason?: string | null;
}

function leaveTypeLabel(value: string): string {
  return LEAVE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function LeaveTable({
  requests,
  loading,
  showEmployee,
  onRowClick,
}: {
  requests: LeaveRow[];
  loading: boolean;
  showEmployee: boolean;
  onRowClick?: (request: LeaveRow) => void;
}) {
  const colSpan = showEmployee ? 6 : 5;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Days</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={colSpan}>Loading leave requests…</TableEmpty>
        ) : requests.length === 0 ? (
          <TableEmpty colSpan={colSpan}>No leave requests match your filters.</TableEmpty>
        ) : (
          requests.map((request) => (
            <TableRow key={request.id} onClick={onRowClick ? () => onRowClick(request) : undefined}>
              {showEmployee && (
                <TableCell>
                  <span className="font-medium">{request.employee?.full_name || '—'}</span>
                  <span className="block text-xs text-muted">{request.employee?.employee_code}</span>
                </TableCell>
              )}
              <TableCell className="text-muted">{leaveTypeLabel(request.leave_type)}</TableCell>
              <TableCell className="text-muted whitespace-nowrap">
                {formatDate(request.start_date)} – {formatDate(request.end_date)}
              </TableCell>
              <TableCell className="text-muted">{request.days_count}</TableCell>
              <TableCell className="text-muted max-w-[220px] truncate">{request.reason || '—'}</TableCell>
              <TableCell>
                <Badge variant={LEAVE_STATUS_BADGE_VARIANT[request.status]}>{request.status}</Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
