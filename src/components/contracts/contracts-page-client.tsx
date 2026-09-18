'use client';

// ============================================================================
// ContractsPageClient — interactive shell for /contracts: search + status
// filter (plus an optional ?client_id= filter from a Client detail page),
// table, pagination, and the "New Contract" modal. Clicking a row opens it
// for editing directly — contracts don't have a separate detail page yet.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContractTable, type ContractRow } from '@/components/contracts/contract-table';
import { ContractForm } from '@/components/contracts/contract-form';
import { CONTRACT_STATUSES } from '@/lib/client-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { CONTRACT_PERMISSIONS } from '@/lib/rbac';

const PAGE_SIZE = 20;

export function ContractsPageClient() {
  const searchParams = useSearchParams();
  const clientIdFilter = searchParams.get('client_id');
  const { can, loading: authLoading } = usePermissions();

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (clientIdFilter) params.set('client_id', clientIdFilter);

      const res = await fetch(`/api/contracts?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load contracts.');
        setContracts([]);
        setTotal(0);
        return;
      }

      setContracts(data.contracts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading contracts.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, clientIdFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchContracts, 300);
    return () => clearTimeout(timeout);
  }, [fetchContracts]);

  useEffect(() => {
    setPage(1);
  }, [search, status, clientIdFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Contracts</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} contract{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && can(CONTRACT_PERMISSIONS.CREATE) && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            New Contract
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search contract code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <ContractTable
          contracts={contracts}
          loading={loading}
          onRowClick={(contract) => {
            setEditing(contract);
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

      <ContractForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchContracts()}
        contract={editing}
        defaultClientId={clientIdFilter}
      />
    </div>
  );
}
