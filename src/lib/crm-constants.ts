// ============================================================================
// CRM / Leads domain constants — dropdown options, pipeline order, and the
// label/color mapping used by <Badge> across the leads table, form, and
// detail page. Keep in sync with the lead_stage_enum / lead_priority_enum /
// lead_activity_type_enum types in db/schema.sql.
// ============================================================================

import type { LeadStage, LeadPriority, LeadActivityType, OpportunityStatus } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = LEAD_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<LeadStage, string>
);

export const LEAD_STAGE_BADGE_VARIANT: Record<LeadStage, BadgeVariant> = {
  new: 'muted',
  contacted: 'primary',
  qualified: 'primary',
  discovery: 'primary',
  proposal_sent: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
};

export const LEAD_PRIORITIES: { value: LeadPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const LEAD_PRIORITY_BADGE_VARIANT: Record<LeadPriority, BadgeVariant> = {
  low: 'muted',
  medium: 'warning',
  high: 'danger',
};

export const LEAD_SOURCES = [
  'Website',
  'Google',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'Fiverr',
  'Upwork',
  'Cold Email',
  'Cold Calling',
  'Referral',
  'WhatsApp',
  'Other',
];

export const LEAD_ACTIVITY_TYPES: { value: LeadActivityType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'proposal', label: 'Proposal' },
];

/** Pipeline stages that count as the lead still being "open" / actionable. */
export const OPEN_LEAD_STAGES: LeadStage[] = [
  'new', 'contacted', 'qualified', 'discovery', 'proposal_sent', 'negotiation',
];

export const OPPORTUNITY_STATUSES: { value: OpportunityStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export const OPPORTUNITY_STATUS_BADGE_VARIANT: Record<OpportunityStatus, BadgeVariant> = {
  open: 'primary',
  won: 'success',
  lost: 'danger',
};
