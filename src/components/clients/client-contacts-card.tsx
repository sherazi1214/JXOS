'use client';

// ============================================================================
// ClientContactsCard — list of a client's contacts with inline add/remove.
// Editing an existing contact's fields (beyond primary toggle) isn't
// exposed yet — add a corrected one and remove the old if needed.
// ============================================================================

import { useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ClientContact } from '@/types/database';

export function ClientContactsCard({
  clientId,
  contacts,
  canEdit,
  onChanged,
}: {
  clientId: string;
  contacts: ClientContact[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ full_name: '', title: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary placeholder:text-muted';

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_primary: contacts.length === 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add contact.');
        return;
      }
      setForm({ full_name: '', title: '', email: '', phone: '' });
      setAdding(false);
      onChanged();
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(contactId: string) {
    await fetch(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' });
    onChanged();
  }

  async function handleMakePrimary(contactId: string) {
    await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    });
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Add
          </Button>
        )}
      </CardHeader>

      {contacts.length === 0 && !adding && (
        <p className="text-sm text-muted">No contacts added yet.</p>
      )}

      <ul className="space-y-3">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white">{c.full_name}</span>
                {c.is_primary && <Star size={12} className="text-warning fill-warning" />}
              </div>
              {c.title && <p className="text-xs text-muted">{c.title}</p>}
              <p className="text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1 shrink-0">
                {!c.is_primary && (
                  <button
                    type="button"
                    onClick={() => handleMakePrimary(c.id)}
                    className="text-xs text-muted hover:text-white"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  className="text-muted hover:text-danger p-1"
                  aria-label="Remove contact"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2 border-t border-border pt-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <input
            className={inputClass}
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Title (e.g. CTO)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
