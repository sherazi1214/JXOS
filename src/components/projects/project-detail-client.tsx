'use client';

// ============================================================================
// ProjectDetailClient — fetches a project (with nested tasks + members)
// from GET /api/projects/:id and renders the detail view: header, financial
// summary, task kanban board, and the team card.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/components/projects/project-form';
import { ProjectMembersCard } from '@/components/projects/project-members-card';
import { KanbanBoard, type TaskRow } from '@/components/projects/kanban-board';
import { TaskForm } from '@/components/projects/task-form';
import {
  PROJECT_STATUS_BADGE_VARIANT,
  PROJECT_PRIORITY_BADGE_VARIANT,
} from '@/lib/project-constants';
import { capitalize, formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { PROJECT_PERMISSIONS } from '@/lib/rbac';
import type { ProjectRecord, TaskStatus } from '@/types/database';

interface ProjectDetail extends ProjectRecord {
  client?: { id: string; company_name: string; client_code: string } | null;
  service?: { id: string; name: string } | null;
  contract?: { id: string; contract_code: string } | null;
  project_manager?: { id: string; full_name: string; employee_code: string } | null;
  project_tasks?: TaskRow[];
  project_members?: {
    employee_id: string;
    role_on_project: string | null;
    added_at: string;
    employee?: { id: string; full_name: string; employee_code: string } | null;
  }[];
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { can, user, loading: authLoading } = usePermissions();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load this project.');
        setProject(null);
        return;
      }
      setProject(data.project);
    } catch {
      setErrorMsg('Network error while loading this project.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function handleDelete() {
    if (!confirm('Delete this project? This can be undone by an administrator.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/projects');
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleTaskStatusChange(task: TaskRow, status: TaskStatus) {
    // Optimistic update so the kanban card moves instantly.
    setProject((prev) =>
      prev
        ? {
            ...prev,
            project_tasks: (prev.project_tasks ?? []).map((t) =>
              t.id === task.id ? { ...t, status } : t
            ),
          }
        : prev
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchProject();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading project…
      </div>
    );
  }

  if (errorMsg || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
          <ArrowLeft size={14} />
          Back to Projects
        </Button>
        <div className="card">
          <p className="text-sm text-danger">{errorMsg || 'Project not found.'}</p>
        </div>
      </div>
    );
  }

  const canUpdate = can(PROJECT_PERMISSIONS.UPDATE);
  const canDelete = can(PROJECT_PERMISSIONS.DELETE);
  const canCreateTask = can('tasks.create');
  const tasks = project.project_tasks ?? [];
  const members = project.project_members ?? [];
  const isMember = members.some((m) => m.employee_id === user?.employee_id);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
        <ArrowLeft size={14} />
        Back to Projects
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{project.name}</h1>
            <Badge variant={PROJECT_STATUS_BADGE_VARIANT[project.status]}>
              {capitalize(project.status.replace('_', ' '))}
            </Badge>
            <Badge variant={PROJECT_PRIORITY_BADGE_VARIANT[project.priority]}>
              {capitalize(project.priority)} priority
            </Badge>
          </div>
          <p className="text-sm text-muted mt-0.5">{project.project_code}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted">
            {project.client && <span>{project.client.company_name}</span>}
            {project.service && <span>{project.service.name}</span>}
            <span>Manager: {project.project_manager?.full_name || 'Unassigned'}</span>
            <span>
              {formatDate(project.start_date)}
              {project.deadline ? ` – ${formatDate(project.deadline)}` : ''}
            </span>
          </div>
        </div>

        {!authLoading && (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil size={14} />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <Trash2 size={14} />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-muted">Budget</p>
          <p className="text-lg font-semibold text-white mt-1">{formatCurrency(project.budget)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Revenue</p>
          <p className="text-lg font-semibold text-white mt-1">{formatCurrency(project.revenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Cost</p>
          <p className="text-lg font-semibold text-white mt-1">{formatCurrency(project.cost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Profit</p>
          <p
            className={`text-lg font-semibold mt-1 ${
              project.profit < 0 ? 'text-danger' : 'text-success'
            }`}
          >
            {formatCurrency(project.profit)}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Progress</p>
          <p className="text-xs text-white">{formatPercent(project.progress_pct)}</p>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, project.progress_pct)}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              {canCreateTask && (canUpdate || isMember) && (
                <Button variant="outline" size="sm" onClick={() => setTaskFormOpen(true)}>
                  <Plus size={14} />
                  New Task
                </Button>
              )}
            </CardHeader>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks yet.</p>
            ) : (
              <KanbanBoard
                tasks={tasks}
                canEditTask={(task) =>
                  can('tasks.update') && (canUpdate || task.assigned_to === user?.employee_id)
                }
                onStatusChange={(task, status) => {
                  const allowed = canUpdate || task.assigned_to === user?.employee_id;
                  if (allowed) handleTaskStatusChange(task, status);
                }}
              />
            )}
          </Card>
        </div>

        <div>
          <ProjectMembersCard
            projectId={project.id}
            members={members}
            projectManagerId={project.project_manager_id}
            canEdit={canUpdate}
            onChanged={fetchProject}
          />
        </div>
      </div>

      <ProjectForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setProject((prev) => (prev ? { ...prev, ...updated } : prev))}
        project={project}
      />

      <TaskForm
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSaved={fetchProject}
        projectId={project.id}
        members={members}
        canAssignOthers={canUpdate}
      />
    </div>
  );
}
