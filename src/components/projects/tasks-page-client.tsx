'use client';

// ============================================================================
// TasksPageClient — /projects/tasks. Defaults to "my tasks" (tasks assigned
// to the current employee) across every project. A manager
// (projects.view_all) can flip to "All Tasks" to see the whole company's
// board instead.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { KanbanBoard, type TaskRow } from '@/components/projects/kanban-board';
import { TASK_STATUSES } from '@/lib/project-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { PROJECT_PERMISSIONS, TASK_PERMISSIONS } from '@/lib/rbac';
import type { TaskStatus } from '@/types/database';

export function TasksPageClient() {
  const router = useRouter();
  const { can, user, loading: authLoading } = usePermissions();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [showAll, setShowAll] = useState(false);

  const canViewAllProjects = can(PROJECT_PERMISSIONS.VIEW_ALL);
  const canUpdateAny = can(PROJECT_PERMISSIONS.UPDATE);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ pageSize: '200' });
      if (status) params.set('status', status);
      params.set('mine', showAll && canViewAllProjects ? 'false' : 'true');

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load tasks.');
        setTasks([]);
        return;
      }
      setTasks(data.tasks ?? []);
    } catch {
      setErrorMsg('Network error while loading tasks.');
    } finally {
      setLoading(false);
    }
  }, [status, showAll, canViewAllProjects]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleStatusChange(task: TaskRow, newStatus: TaskStatus) {
    const allowed = canUpdateAny || task.assigned_to === user?.employee_id;
    if (!allowed) return;

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTasks();
  }

  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">
          {showAll && canViewAllProjects ? 'All Tasks' : 'My Tasks'}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {showAll && canViewAllProjects
            ? 'Every task across every project.'
            : 'Tasks assigned to you, across all your projects.'}
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {canViewAllProjects && (
            <label className="flex items-center gap-2 text-sm text-muted ml-auto">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="accent-primary"
              />
              Show all tasks
            </label>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        {loading || authLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted py-6">
            <Loader2 size={16} className="animate-spin" />
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted py-6">No tasks to show.</p>
        ) : (
          <KanbanBoard
            tasks={tasks}
            showProject
            canEditTask={(task) =>
              can(TASK_PERMISSIONS.UPDATE) && (canUpdateAny || task.assigned_to === user?.employee_id)
            }
            onCardClick={(task) => task.project?.id && router.push(`/projects/${task.project.id}`)}
            onStatusChange={handleStatusChange}
          />
        )}
      </Card>
    </div>
  );
}
