'use client';

// ============================================================================
// ProjectsPageClient — interactive shell for /projects: search + status/
// priority filters (plus an optional ?client_id= filter from a Client
// detail page), table, pagination, and the "New Project" modal. Clicking a
// row navigates to the project's detail page.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProjectTable, type ProjectRow } from '@/components/projects/project-table';
import { ProjectForm } from '@/components/projects/project-form';
import { ProjectsTabs } from '@/components/projects/projects-tabs';
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from '@/lib/project-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { PROJECT_PERMISSIONS } from '@/lib/rbac';

const PAGE_SIZE = 20;

export function ProjectsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdFilter = searchParams.get('client_id');
  const { can, loading: authLoading } = usePermissions();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (clientIdFilter) params.set('client_id', clientIdFilter);

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load projects.');
        setProjects([]);
        setTotal(0);
        return;
      }

      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading projects.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority, clientIdFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchProjects, 300);
    return () => clearTimeout(timeout);
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [search, status, priority, clientIdFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Projects</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} project{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && can(PROJECT_PERMISSIONS.CREATE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            New Project
          </Button>
        )}
      </div>

      <ProjectsTabs />

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search project code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            {PROJECT_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <ProjectTable
          projects={projects}
          loading={loading}
          onRowClick={(project) => router.push(`/projects/${project.id}`)}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(project) => router.push(`/projects/${project.id}`)}
        defaultClientId={clientIdFilter}
      />
    </div>
  );
}
