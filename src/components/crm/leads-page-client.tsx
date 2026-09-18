'use client';

// ============================================================================
// LeadsPageClient — the interactive shell for /crm/leads: search + filters,
// the leads table, pagination, and the "Add Lead" modal. Talks to
// /api/leads directly (rather than receiving server-fetched data as props)
// so filtering/pagination round-trip through the real API, same as every
// other client that will eventually consume it (mobile PWA, future admin
// tools, etc).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LeadTable, type LeadRow } from '@/components/crm/lead-table';
import { LeadForm } from '@/components/crm/lead-form';
import { LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/crm-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAD_PERMISSIONS } from '@/lib/rbac';

const PAGE_SIZE = 20;

export function LeadsPageClient() {
  const router = useRouter();
  const { can, loading: authLoading } = usePermissions();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [priority, setPriority] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (stage) params.set('stage', stage);
      if (priority) params.set('priority', priority);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load leads.');
        setLeads([]);
        setTotal(0);
        return;
      }

      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading leads.');
    } finally {
      setLoading(false);
    }
  }, [page, search, stage, priority]);

  useEffect(() => {
    const timeout = setTimeout(fetchLeads, 300); // debounce search keystrokes
    return () => clearTimeout(timeout);
  }, [fetchLeads]);

  useEffect(() => {
    setPage(1);
  }, [search, stage, priority]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Leads</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} lead{total === 1 ? '' : 's'} in the pipeline
          </p>
        </div>
        {!authLoading && can(LEAD_PERMISSIONS.CREATE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Add Lead
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              type="text"
              placeholder="Search company, contact, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none"
            />
          </div>

          <select className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All Stages</option>
            {LEAD_STAGES.map((s) => (
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
            {LEAD_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <LeadTable
          leads={leads}
          loading={loading}
          onRowClick={(lead) => router.push(`/crm/leads/${lead.id}`)}
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

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchLeads()}
        canAssign={can(LEAD_PERMISSIONS.ASSIGN)}
      />
    </div>
  );
}
