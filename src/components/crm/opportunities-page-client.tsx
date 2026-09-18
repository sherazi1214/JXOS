'use client';

// ============================================================================
// OpportunitiesPageClient — interactive shell for /crm/opportunities:
// status filter + search, the table, pagination, and the "New Opportunity"
// modal (with its own lead-search combobox since there's no locked lead
// context here). Mirrors LeadsPageClient's structure.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OpportunityTable, type OpportunityRow } from '@/components/crm/opportunity-table';
import { OpportunityForm } from '@/components/crm/opportunity-form';
import { OPPORTUNITY_STATUSES } from '@/lib/crm-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAD_PERMISSIONS, OPPORTUNITY_PERMISSIONS } from '@/lib/rbac';
import type { Opportunity } from '@/types/database';

const PAGE_SIZE = 20;

export function OpportunitiesPageClient() {
  const { can, loading: authLoading } = usePermissions();

  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);

      const res = await fetch(`/api/opportunities?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load opportunities.');
        setOpportunities([]);
        setTotal(0);
        return;
      }

      setOpportunities(data.opportunities ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading opportunities.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timeout = setTimeout(fetchOpportunities, 300);
    return () => clearTimeout(timeout);
  }, [fetchOpportunities]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Opportunities</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} opportunit{total === 1 ? 'y' : 'ies'} across the pipeline
          </p>
        </div>
        {!authLoading && can(OPPORTUNITY_PERMISSIONS.CREATE) && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            New Opportunity
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search opportunity name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {OPPORTUNITY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <OpportunityTable
          opportunities={opportunities}
          loading={loading}
          onRowClick={(opp) => {
            setEditing(opp);
            setFormOpen(true);
          }}
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

      <OpportunityForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchOpportunities()}
        opportunity={editing}
        canAssign={can(LEAD_PERMISSIONS.ASSIGN)}
      />
    </div>
  );
}
