// ============================================================================
// Asset & IT domain constants — mirrors the shape of hr-constants.ts.
// ============================================================================

import type { AssetStatus, AssetCondition } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_repair', label: 'In Repair' },
  { value: 'retired', label: 'Retired' },
];

export const ASSET_STATUS_BADGE_VARIANT: Record<AssetStatus, BadgeVariant> = {
  available: 'success',
  assigned: 'primary',
  in_repair: 'warning',
  retired: 'muted',
};

export const ASSET_CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export const ASSET_CONDITION_BADGE_VARIANT: Record<AssetCondition, BadgeVariant> = {
  new: 'success',
  good: 'primary',
  fair: 'warning',
  poor: 'danger',
};

export const ASSET_TYPES = [
  'Laptop', 'Desktop', 'Mobile', 'Monitor', 'Printer', 'Networking Equipment',
  'Software License', 'Furniture', 'Other',
];
