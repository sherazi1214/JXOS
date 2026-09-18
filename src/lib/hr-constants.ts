// ============================================================================
// HR domain constants — labels and badge-color mapping for the Employee
// Master, mirroring the shape of finance-constants.ts / client-constants.ts.
// ============================================================================

import type { EmployeeStatus, EmploymentType, AttendanceStatus, LeaveStatus } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
];

export const EMPLOYEE_STATUS_BADGE_VARIANT: Record<EmployeeStatus, BadgeVariant> = {
  active: 'success',
  on_leave: 'warning',
  suspended: 'danger',
  terminated: 'muted',
};

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
];

export const ATTENDANCE_STATUS_BADGE_VARIANT: Record<AttendanceStatus, BadgeVariant> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  half_day: 'warning',
  leave: 'primary',
  holiday: 'muted',
};

// ----------------------------------------------------------------------------
// Leave Requests (Module 9 — Attendance & Leave). `leave_type` is a free-text
// column in the DB (db/schema.sql), not an enum — these are just the common
// starter values offered in the form; anyone can still submit a custom one.
// ----------------------------------------------------------------------------

export const LEAVE_TYPES: { value: string; label: string }[] = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'casual', label: 'Casual' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'other', label: 'Other' },
];

export const LEAVE_STATUSES: { value: LeaveStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const LEAVE_STATUS_BADGE_VARIANT: Record<LeaveStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'muted',
};
