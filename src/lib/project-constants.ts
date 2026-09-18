// ============================================================================
// Projects & Tasks domain constants — mirrors the shape of crm-constants.ts.
// ============================================================================

import type { ProjectStatus, ProjectPriority, TaskStatus } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PROJECT_STATUS_BADGE_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  planning: 'muted',
  in_progress: 'primary',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const PROJECT_PRIORITY_BADGE_VARIANT: Record<ProjectPriority, BadgeVariant> = {
  low: 'muted',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

export const TASK_STATUS_BADGE_VARIANT: Record<TaskStatus, BadgeVariant> = {
  not_started: 'muted',
  in_progress: 'primary',
  review: 'warning',
  blocked: 'danger',
  completed: 'success',
};

/** Column order for the task kanban board. */
export const TASK_KANBAN_COLUMNS: TaskStatus[] = [
  'not_started', 'in_progress', 'review', 'blocked', 'completed',
];
