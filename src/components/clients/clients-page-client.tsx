'use client';

// ============================================================================
// ClientsPageClient — interactive shell for /clients: search + status
// filter, table, pagination, and the "New Client" modal. Same structure as
// LeadsPageClient / OpportunitiesPageClient.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ClientTable, type ClientRow } from '@/components/clients/client-table';
import { ClientForm } from '@/components/clients/client-form';
import { CLIENT_STATUSES } from '@/lib/client-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { CLIENT_PERMISSIONS } from '@/lib/rbac';

const PAGE_SIZE = 20;

export function ClientsPageClient() {
  const router = useRouter();
  const { can, loading: authLoading } = usePermissions();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);

      const res = await fetch(`/api/clients?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load clients.');
        setClients([]);
        setTotal(0);
        return;
      }

      setClients(data.clients ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading clients.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timeout = setTimeout(fetchClients, 300);
    return () => clearTimeout(timeout);
  }, [fetchClients]);

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
          <h1 className="text-xl font-semibold text-white">Clients</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} client{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && can(CLIENT_PERMISSIONS.CREATE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            New Client
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search company name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <ClientTable
          clients={clients}
          loading={loading}
          onRowClick={(client) => router.push(`/clients/${client.id}`)}
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

      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchClients()}
        canAssign={can(CLIENT_PERMISSIONS.ASSIGN)}
      />
    </div>
  );
}
