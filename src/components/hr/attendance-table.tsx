'use client';

// ============================================================================
// AttendanceTable — presentational table of attendance records. The
// employee column only renders when the caller passes showEmployee (i.e.
// the viewer has attendance.view_all) — an individual's own history doesn't
// need to repeat their own name on every row.
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
import { ATTENDANCE_STATUS_BADGE_VARIANT } from '@/lib/hr-constants';
import { capitalize, formatDate } from '@/lib/utils';
import type { AttendanceRecord } from '@/types/database';

export interface AttendanceRow extends AttendanceRecord {
  employee?: { id: string; employee_code: string; full_name: string } | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso)
  );
}

export function AttendanceTable({
  records,
  loading,
  showEmployee,
  onRowClick,
}: {
  records: AttendanceRow[];
  loading: boolean;
  showEmployee: boolean;
  onRowClick?: (record: AttendanceRow) => void;
}) {
  const colSpan = showEmployee ? 7 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Late</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={colSpan}>Loading attendance…</TableEmpty>
        ) : records.length === 0 ? (
          <TableEmpty colSpan={colSpan}>No attendance records for this range.</TableEmpty>
        ) : (
          records.map((record) => (
            <TableRow
              key={record.id}
              onClick={onRowClick ? () => onRowClick(record) : undefined}
            >
              <TableCell className="font-medium">{formatDate(record.attendance_date)}</TableCell>
              {showEmployee && (
                <TableCell className="text-muted">
                  {record.employee?.full_name || '—'}
                  {record.employee?.employee_code && (
                    <span className="block text-xs">{record.employee.employee_code}</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-muted">{formatTime(record.check_in)}</TableCell>
              <TableCell className="text-muted">{formatTime(record.check_out)}</TableCell>
              <TableCell className="text-muted">
                {record.working_hours ?? '—'}
                {record.overtime_hours > 0 && (
                  <span className="block text-xs text-warning">+{record.overtime_hours}h OT</span>
                )}
              </TableCell>
              <TableCell className={record.late_minutes > 0 ? 'text-warning' : 'text-muted'}>
                {record.late_minutes > 0 ? `${record.late_minutes}m` : '—'}
              </TableCell>
              <TableCell>
                <Badge variant={ATTENDANCE_STATUS_BADGE_VARIANT[record.status]}>
                  {capitalize(record.status.replace('_', ' '))}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
