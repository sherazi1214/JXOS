'use client';

// ============================================================================
// ClientServicesCard — services linked to a client, with a picker (from the
// service catalog) to link a new one and a remove action that ends the
// link (soft — sets ended_at, doesn't delete history).
// ============================================================================

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { ClientService, Service } from '@/types/database';

export interface ClientServiceRow extends ClientService {
  service?: { id: string; name: string } | null;
}

export function ClientServicesCard({
  clientId,
  clientServices,
  canEdit,
  onChanged,
}: {
  clientId: string;
  clientServices: ClientServiceRow[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) return;
    fetch('/api/services')
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => setCatalog(data.services ?? []))
      .catch(() => setCatalog([]));
  }, [adding]);

  const active = clientServices.filter((cs) => !cs.ended_at);
  const linkedIds = new Set(active.map((cs) => cs.service_id));
  const available = catalog.filter((s) => !linkedIds.has(s.id));

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Pick a service.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to link service.');
        return;
      }
      setSelected('');
      setAdding(false);
      onChanged();
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink(clientServiceId: string) {
    await fetch(`/api/clients/${clientId}/services/${clientServiceId}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services</CardTitle>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Link Service
          </Button>
        )}
      </CardHeader>

      {active.length === 0 && !adding && (
        <p className="text-sm text-muted">No services linked yet.</p>
      )}

      <ul className="space-y-2">
        {active.map((cs) => (
          <li
            key={cs.id}
            className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
          >
            <div>
              <span className="text-sm text-white">{cs.service?.name || 'Service'}</span>
              <span className="block text-xs text-muted">Since {formatDate(cs.started_at)}</span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleUnlink(cs.id)}
                className="text-muted hover:text-danger p-1"
                aria-label="Unlink service"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <form onSubmit={handleLink} className="mt-3 space-y-2 border-t border-border pt-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <select
            className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a service…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Link
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
