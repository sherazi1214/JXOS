// ============================================================================
// Payroll domain constants — mirrors the shape of finance-constants.ts.
// ============================================================================

import type { PayrollStatus } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const PAYROLL_STATUSES: { value: PayrollStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'locked', label: 'Locked' },
];

export const PAYROLL_STATUS_BADGE_VARIANT: Record<PayrollStatus, BadgeVariant> = {
  draft: 'muted',
  approved: 'primary',
  locked: 'success',
};

/** First-of-month key used everywhere payroll periods are stored/compared. */
export function periodMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatPeriodMonth(period: string): string {
  const parts = period.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}
