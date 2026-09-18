'use client';

// ============================================================================
// TaskCard — a single task inside the kanban board (or a flat task list).
// Shows priority, assignee, due date (flagged red if overdue), and — if the
// viewer is allowed to move it — a status <select> standing in for
// drag-and-drop, which this environment doesn't have a library for.
// ============================================================================

import { Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TASK_STATUSES, PROJECT_PRIORITY_BADGE_VARIANT } from '@/lib/project-constants';
import { capitalize, formatDate } from '@/lib/utils';
import type { TaskStatus } from '@/types/database';
import type { TaskRow } from '@/components/projects/kanban-board';

export function TaskCard({
  task,
  canEdit,
  showProject = false,
  onClick,
  onStatusChange,
}: {
  task: TaskRow;
  canEdit: boolean;
  showProject?: boolean;
  onClick?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
}) {
  const isOverdue =
    task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();

  return (
    <div
      onClick={onClick}
      className={
        'rounded-lg border border-border bg-background/40 p-3 space-y-2' +
        (onClick ? ' cursor-pointer hover:border-primary/50 transition-colors' : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white font-medium leading-snug">{task.name}</p>
        <Badge variant={PROJECT_PRIORITY_BADGE_VARIANT[task.priority]} className="shrink-0">
          {capitalize(task.priority)}
        </Badge>
      </div>

      {showProject && task.project?.name && (
        <p className="text-xs text-muted">{task.project.name}</p>
      )}

      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <User size={12} />
          {task.assignee?.full_name || 'Unassigned'}
        </span>
        {task.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger' : ''}`}>
            <Clock size={12} />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>

      {canEdit && onStatusChange && (
        <select
          value={task.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          className="w-full rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-white outline-none focus:border-primary"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
