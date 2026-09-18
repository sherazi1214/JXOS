// ============================================================================
// Recruitment domain constants — mirrors the shape of hr-constants.ts.
// ============================================================================

import type { RecruitmentStage } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const RECRUITMENT_STAGES: { value: RecruitmentStage; label: string }[] = [
  { value: 'application', label: 'Application' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'technical', label: 'Technical' },
  { value: 'final', label: 'Final' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

export const RECRUITMENT_STAGE_LABELS: Record<RecruitmentStage, string> = RECRUITMENT_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<RecruitmentStage, string>
);

export const RECRUITMENT_STAGE_BADGE_VARIANT: Record<RecruitmentStage, BadgeVariant> = {
  application: 'muted',
  screening: 'primary',
  interview: 'primary',
  technical: 'warning',
  final: 'warning',
  offer: 'warning',
  hired: 'success',
  rejected: 'danger',
};

/** Stages that still count as an open/active application. */
export const OPEN_RECRUITMENT_STAGES: RecruitmentStage[] = [
  'application', 'screening', 'interview', 'technical', 'final', 'offer',
];
