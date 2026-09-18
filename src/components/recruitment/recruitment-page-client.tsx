'use client';

// ============================================================================
// RecruitmentPageClient — interactive shell for /hr/recruitment: search +
// stage/department filters, table, pagination, "Add Candidate" modal, and a
// "Hire" action on offer-stage candidates. Same structure as
// EmployeesPageClient/LeadsPageClient.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CandidateTable, type CandidateRow } from '@/components/recruitment/candidate-table';
import { CandidateForm } from '@/components/recruitment/candidate-form';
import { HireModal } from '@/components/recruitment/hire-modal';
import { RECRUITMENT_STAGES } from '@/lib/recruitment-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { RECRUITMENT_PERMISSIONS, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';
import type { Department } from '@/types/database';

const PAGE_SIZE = 20;

export function RecruitmentPageClient() {
  const { can, loading: authLoading } = usePermissions();

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateRow | null>(null);
  const [hiring, setHiring] = useState<CandidateRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canCreate = can(RECRUITMENT_PERMISSIONS.CREATE);
  const canUpdate = can(RECRUITMENT_PERMISSIONS.UPDATE);
  const canHire = canUpdate && can(EMPLOYEE_PERMISSIONS.CREATE);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (stage) params.set('stage', stage);
      if (departmentId) params.set('department_id', departmentId);

      const res = await fetch(`/api/recruitment?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load candidates.');
        setCandidates([]);
        setTotal(0);
        return;
      }

      setCandidates(data.candidates ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading candidates.');
    } finally {
      setLoading(false);
    }
  }, [page, search, stage, departmentId]);

  useEffect(() => {
    const timeout = setTimeout(fetchCandidates, 300);
    return () => clearTimeout(timeout);
  }, [fetchCandidates]);

  useEffect(() => {
    setPage(1);
  }, [search, stage, departmentId]);

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Recruitment</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} candidate{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            Add Candidate
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search name, email, position…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All Stages</option>
            {RECRUITMENT_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className={selectClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <CandidateTable
          candidates={candidates}
          loading={loading}
          onRowClick={(candidate) => {
            if (!canUpdate || candidate.stage === 'hired') return;
            setEditing(candidate);
            setFormOpen(true);
          }}
        />

        {canHire && candidates.some((c) => c.stage === 'offer') && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted mb-2">Candidates at Offer stage, ready to hire:</p>
            <div className="flex flex-wrap gap-2">
              {candidates
                .filter((c) => c.stage === 'offer')
                .map((c) => (
                  <Button key={c.id} variant="outline" size="sm" onClick={() => setHiring(c)}>
                    <UserCheck size={14} />
                    Hire {c.full_name}
                  </Button>
                ))}
            </div>
          </div>
        )}

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

      <CandidateForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchCandidates()}
        candidate={editing}
      />

      <HireModal open={Boolean(hiring)} onClose={() => setHiring(null)} onHired={() => fetchCandidates()} candidate={hiring} />
    </div>
  );
}
