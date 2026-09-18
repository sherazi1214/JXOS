'use client';

// ============================================================================
// ProjectTable — presentational table of projects. Same shape as
// ContractTable/ClientTable for consistency.
// ============================================================================

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  PROJECT_STATUS_BADGE_VARIANT,
  PROJECT_PRIORITY_BADGE_VARIANT,
} from '@/lib/project-constants';
import { capitalize, formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import type { ProjectRecord } from '@/types/database';

export interface ProjectRow extends ProjectRecord {
  client?: { id: string; company_name: string; client_code: string } | null;
  service?: { id: string; name: string } | null;
  project_manager?: { id: string; full_name: string; employee_code: string } | null;
}

export function ProjectTable({
  projects,
  loading,
  onRowClick,
}: {
  projects: ProjectRow[];
  loading: boolean;
  onRowClick: (project: ProjectRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Profit</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={8}>Loading projects…</TableEmpty>
        ) : projects.length === 0 ? (
          <TableEmpty colSpan={8}>No projects match your filters.</TableEmpty>
        ) : (
          projects.map((project) => (
            <TableRow key={project.id} onClick={() => onRowClick(project)}>
              <TableCell>
                <span className="font-medium">{project.name}</span>
                <span className="block text-xs text-muted">{project.project_code}</span>
              </TableCell>
              <TableCell className="text-muted">{project.client?.company_name || '—'}</TableCell>
              <TableCell className="text-muted">
                {project.project_manager?.full_name || 'Unassigned'}
              </TableCell>
              <TableCell className="text-muted">
                {project.deadline ? formatDate(project.deadline) : '—'}
              </TableCell>
              <TableCell className="text-muted">
                <div className="flex items-center gap-2 min-w-[90px]">
                  <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, project.progress_pct)}%` }}
                    />
                  </div>
                  <span className="text-xs whitespace-nowrap">
                    {formatPercent(project.progress_pct)}
                  </span>
                </div>
              </TableCell>
              <TableCell className={project.profit < 0 ? 'text-danger' : 'text-success'}>
                {formatCurrency(project.profit)}
              </TableCell>
              <TableCell>
                <Badge variant={PROJECT_PRIORITY_BADGE_VARIANT[project.priority]}>
                  {capitalize(project.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={PROJECT_STATUS_BADGE_VARIANT[project.status]}>
                  {capitalize(project.status.replace('_', ' '))}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
