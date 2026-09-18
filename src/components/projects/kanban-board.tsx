'use client';

// ============================================================================
// KanbanBoard — groups tasks into columns by status (TASK_KANBAN_COLUMNS).
// No drag-and-drop library is available in this environment, so moving a
// task between columns happens via the status <select> on each TaskCard
// (see task-card.tsx) rather than dragging.
// ============================================================================

import { TASK_KANBAN_COLUMNS, TASK_STATUSES } from '@/lib/project-constants';
import { TaskCard } from '@/components/projects/task-card';
import type { ProjectTask, TaskStatus } from '@/types/database';

export interface TaskRow extends ProjectTask {
  assignee?: { id: string; full_name: string; employee_code: string } | null;
  project?: { id: string; project_code: string; name: string; client_id: string } | null;
}

const STATUS_LABEL: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label])
) as Record<TaskStatus, string>;

export function KanbanBoard({
  tasks,
  canEditTask,
  showProject = false,
  onCardClick,
  onStatusChange,
}: {
  tasks: TaskRow[];
  /** Per-task check — a manager can edit any task, a plain Employee only
   *  their own assigned one, so this can't be a single board-wide flag. */
  canEditTask: (task: TaskRow) => boolean;
  showProject?: boolean;
  onCardClick?: (task: TaskRow) => void;
  onStatusChange?: (task: TaskRow, status: TaskStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {TASK_KANBAN_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column);
        return (
          <div key={column} className="space-y-3 min-w-0">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {STATUS_LABEL[column]}
              </h3>
              <span className="text-xs text-muted">{columnTasks.length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-muted px-1">No tasks.</p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEditTask(task)}
                    showProject={showProject}
                    onClick={onCardClick ? () => onCardClick(task) : undefined}
                    onStatusChange={
                      onStatusChange ? (status) => onStatusChange(task, status) : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
