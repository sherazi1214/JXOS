// ============================================================================
// Vendor / Subscription domain constants — mirrors the shape of
// finance-constants.ts.
// ============================================================================

import type { SubscriptionBillingCycle } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const BILLING_CYCLES: { value: SubscriptionBillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-Time' },
];

export const BILLING_CYCLE_BADGE_VARIANT: Record<SubscriptionBillingCycle, BadgeVariant> = {
  monthly: 'primary',
  quarterly: 'primary',
  yearly: 'success',
  one_time: 'muted',
};

/** A renewal within this many days is flagged for the CEO/Finance alert. */
export const RENEWAL_ALERT_WINDOW_DAYS = 14;

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
