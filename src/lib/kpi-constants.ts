// ============================================================================
// Company Goals & KPI domain constants — mirrors the shape of
// finance-constants.ts. Achievement badge color is threshold-based rather
// than a fixed enum mapping, since achievement_pct is a computed number,
// not a closed status list.
// ============================================================================

import type { KpiPeriod } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const KPI_PERIODS: { value: KpiPeriod; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export const COMMON_KPI_METRICS = [
  'Revenue', 'New Clients', 'New Leads', 'Sales Closed', 'Project Completion',
  'Net Profit', 'Employee Headcount', 'Marketing Qualified Leads',
];

/** Threshold-based badge for an achievement_pct value (0-100+). */
export function achievementBadgeVariant(pct: number): BadgeVariant {
  if (pct >= 100) return 'success';
  if (pct >= 75) return 'primary';
  if (pct >= 40) return 'warning';
  return 'danger';
}
