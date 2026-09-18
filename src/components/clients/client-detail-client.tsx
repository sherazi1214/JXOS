'use client';

// ============================================================================
// ClientDetailClient — fetches a client (with nested contacts, services,
// contracts) from GET /api/clients/:id and renders the detail view. The
// Contracts list here is read-only for now — full contract management
// (renewals, documents, status changes) is its own upcoming module; this
// just surfaces what a Lead→Client conversion already created.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, MapPin, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/clients/client-form';
import { ClientContactsCard } from '@/components/clients/client-contacts-card';
import { ClientServicesCard, type ClientServiceRow } from '@/components/clients/client-services-card';
import { CLIENT_STATUS_BADGE_VARIANT, CONTRACT_STATUS_BADGE_VARIANT } from '@/lib/client-constants';
import { capitalize, formatCurrency, formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { CLIENT_PERMISSIONS } from '@/lib/rbac';
import type { Client, ClientContact, Contract } from '@/types/database';

interface ClientDetail extends Client {
  account_manager?: { id: string; full_name: string; employee_code: string } | null;
  client_contacts?: ClientContact[];
  client_services?: ClientServiceRow[];
  contracts?: Pick<
    Contract,
    'id' | 'contract_code' | 'status' | 'contract_value' | 'monthly_recurring_amt' | 'currency' | 'start_date' | 'end_date'
  >[];
}

export function ClientDetailClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { can, loading: authLoading } = usePermissions();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load this client.');
        setClient(null);
        return;
      }
      setClient(data.client);
    } catch {
      setErrorMsg('Network error while loading this client.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  async function handleDelete() {
    if (!confirm('Delete this client? This can be undone by an administrator.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/clients');
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading client…
      </div>
    );
  }

  if (errorMsg || !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft size={14} />
          Back to Clients
        </Button>
        <div className="card">
          <p className="text-sm text-danger">{errorMsg || 'Client not found.'}</p>
        </div>
      </div>
    );
  }

  const canUpdate = can(CLIENT_PERMISSIONS.UPDATE);
  const canDelete = can(CLIENT_PERMISSIONS.DELETE);
  const canAssign = can(CLIENT_PERMISSIONS.ASSIGN);
  const contracts = client.contracts ?? [];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
        <ArrowLeft size={14} />
        Back to Clients
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{client.company_name}</h1>
            <Badge variant={CLIENT_STATUS_BADGE_VARIANT[client.status]}>
              {capitalize(client.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted mt-0.5">{client.client_code}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted">
            {client.industry && <span>{client.industry}</span>}
            {client.country && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {client.country}
              </span>
            )}
            <span>Client since {formatDate(client.client_since)}</span>
            <span>Account manager: {client.account_manager?.full_name || 'Unassigned'}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contracts</CardTitle>
              <Link
                href={`/contracts?client_id=${client.id}`}
                className="flex items-center gap-1 text-xs text-muted hover:text-white"
              >
                Manage Contracts <ExternalLink size={12} />
              </Link>
            </CardHeader>
            {contracts.length === 0 ? (
              <p className="text-sm text-muted">
                No contracts yet. Converting a won lead automatically creates a draft contract
                here.
              </p>
            ) : (
              <ul className="space-y-3">
                {contracts.map((ct) => (
                  <li
                    key={ct.id}
                    className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="text-sm text-white">{ct.contract_code}</span>
                      <p className="text-xs text-muted mt-0.5">
                        {formatCurrency(ct.contract_value, ct.currency)}
                        {ct.monthly_recurring_amt > 0 &&
                          ` · ${formatCurrency(ct.monthly_recurring_amt, ct.currency)}/mo`}
                        {' · '}
                        {formatDate(ct.start_date)}
                        {ct.end_date ? ` – ${formatDate(ct.end_date)}` : ' – ongoing'}
                      </p>
                    </div>
                    <Badge variant={CONTRACT_STATUS_BADGE_VARIANT[ct.status]}>
                      {capitalize(ct.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <p className="text-sm text-white whitespace-pre-wrap">{client.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <ClientContactsCard
            clientId={client.id}
            contacts={client.client_contacts ?? []}
            canEdit={canUpdate}
            onChanged={fetchClient}
          />
          <ClientServicesCard
            clientId={client.id}
            clientServices={client.client_services ?? []}
            canEdit={canUpdate}
            onChanged={fetchClient}
          />
        </div>
      </div>

      <ClientForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setClient((prev) => (prev ? { ...prev, ...updated } : prev))}
        client={client}
        canAssign={canAssign}
      />
    </div>
  );
}
