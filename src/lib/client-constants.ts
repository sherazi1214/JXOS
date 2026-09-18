// ============================================================================
// Client / Contract domain constants — labels and badge-color mapping,
// mirroring the shape of crm-constants.ts for the CRM module.
// ============================================================================

import type { ClientStatus, ContractStatus } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'churned', label: 'Churned' },
];

export const CLIENT_STATUS_BADGE_VARIANT: Record<ClientStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'muted',
  churned: 'danger',
};

export const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

export const CONTRACT_STATUS_BADGE_VARIANT: Record<ContractStatus, BadgeVariant> = {
  draft: 'muted',
  active: 'success',
  expired: 'warning',
  terminated: 'danger',
};
