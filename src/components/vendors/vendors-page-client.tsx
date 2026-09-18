'use client';

// ============================================================================
// VendorsPageClient — interactive shell for /vendors: vendor list, each with
// its subscriptions inline, renewal-window highlighting, "Add Vendor" and
// "Add Subscription" modals.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, AlertTriangle, Building2, Wallet, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { VENDOR_PERMISSIONS } from '@/lib/rbac';
import { BILLING_CYCLES, RENEWAL_ALERT_WINDOW_DAYS, daysUntil } from '@/lib/vendor-constants';

interface Subscription {
  id: string;
  service_name: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  start_date: string;
  renewal_date: string | null;
  is_active: boolean;
}

interface Vendor {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  subscriptions: Subscription[];
}

const inputClass =
  'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary';

export function VendorsPageClient() {
  const { can, loading: authLoading } = usePermissions();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [subFormOpen, setSubFormOpen] = useState<string | null>(null); // vendor id

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vendors');
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load vendors.');
        return;
      }
      setVendors(data.vendors ?? []);
    } catch {
      setErrorMsg('Network error while loading vendors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const totalMonthlySpend = vendors.reduce(
    (sum, v) =>
      sum +
      v.subscriptions
        .filter((s) => s.is_active)
        .reduce((s, sub) => {
          const monthly =
            sub.billing_cycle === 'yearly' ? sub.cost / 12 : sub.billing_cycle === 'quarterly' ? sub.cost / 3 : sub.billing_cycle === 'one_time' ? 0 : sub.cost;
          return s + monthly;
        }, 0),
    0
  );

  const { activeSubs, upcomingRenewals } = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    for (const v of vendors) {
      for (const sub of v.subscriptions) {
        if (sub.is_active) active += 1;
        const remaining = daysUntil(sub.renewal_date);
        if (remaining !== null && remaining <= RENEWAL_ALERT_WINDOW_DAYS) upcoming += 1;
      }
    }
    return { activeSubs: active, upcomingRenewals: upcoming };
  }, [vendors]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Vendors &amp; Subscriptions</h1>
          <p className="text-sm text-muted mt-0.5">
            Track every vendor relationship and recurring spend in one place.
          </p>
        </div>
        {!authLoading && can(VENDOR_PERMISSIONS.CREATE) && (
          <Button onClick={() => setVendorFormOpen(true)}>
            <Plus size={16} />
            Add Vendor
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Vendors" value={String(vendors.length)} icon={Building2} tone="primary" hint="Total onboarded" />
        <StatCard
          label="Monthly Recurring"
          value={formatCurrency(totalMonthlySpend)}
          icon={Wallet}
          tone="accent"
          hint={`${activeSubs} active subscription${activeSubs === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Renewals Due Soon"
          value={String(upcomingRenewals)}
          icon={CalendarClock}
          tone={upcomingRenewals > 0 ? 'warning' : 'success'}
          hint={`within ${RENEWAL_ALERT_WINDOW_DAYS} days`}
        />
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ) : vendors.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <span className="icon-tile bg-primary/15 text-primary-light ring-1 ring-inset ring-primary/25 mb-3">
            <Building2 size={20} />
          </span>
          <p className="text-sm font-medium text-white">No vendors yet</p>
          <p className="text-sm text-muted mt-1 max-w-sm">
            Add your first vendor to start tracking contracts, subscriptions and renewal dates.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {vendors.map((vendor) => {
            const initials = vendor.name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <Card key={vendor.id} className="card-hover">
                <CardHeader>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="icon-tile bg-white/10 text-white font-semibold text-sm">{initials}</span>
                    <div className="min-w-0">
                      <CardTitle>{vendor.name}</CardTitle>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {vendor.contact_email || 'No contact email'}
                        {vendor.contact_phone ? ` · ${vendor.contact_phone}` : ''}
                      </p>
                    </div>
                  </div>
                  {!authLoading && can(VENDOR_PERMISSIONS.CREATE) && (
                    <Button variant="outline" size="sm" onClick={() => setSubFormOpen(vendor.id)}>
                      <Plus size={14} />
                      Add Subscription
                    </Button>
                  )}
                </CardHeader>

                {vendor.subscriptions.length === 0 ? (
                  <p className="text-sm text-muted">No subscriptions logged for this vendor.</p>
                ) : (
                  <div className="space-y-2">
                    {vendor.subscriptions.map((sub) => {
                      const remaining = daysUntil(sub.renewal_date);
                      const soon = remaining !== null && remaining <= RENEWAL_ALERT_WINDOW_DAYS && remaining >= 0;
                      const overdue = remaining !== null && remaining < 0;
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-surface2/40 px-3 py-2.5 transition-colors hover:border-white/15"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{sub.service_name}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {formatCurrency(sub.cost, sub.currency)} / {sub.billing_cycle.replace('_', ' ')} · started{' '}
                              {formatDate(sub.start_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!sub.is_active && <Badge variant="muted">Inactive</Badge>}
                            {sub.renewal_date && (
                              <Badge variant={overdue ? 'danger' : soon ? 'warning' : 'default'}>
                                {(overdue || soon) && <AlertTriangle size={11} />}
                                Renews {formatDate(sub.renewal_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <VendorFormModal
        open={vendorFormOpen}
        onClose={() => setVendorFormOpen(false)}
        onSaved={() => {
          setVendorFormOpen(false);
          fetchVendors();
        }}
      />

      <SubscriptionFormModal
        vendorId={subFormOpen}
        onClose={() => setSubFormOpen(null)}
        onSaved={() => {
          setSubFormOpen(null);
          fetchVendors();
        }}
      />
    </div>
  );
}

function VendorFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact_email: email || null, contact_phone: phone || null, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save vendor.');
        return;
      }
      onSaved();
    } catch {
      setError('Network error while saving the vendor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Vendor"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="text-xs text-muted mb-1 block">Vendor Name *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Contact Email</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Contact Phone</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Notes</label>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function SubscriptionFormModal({
  vendorId,
  onClose,
  onSaved,
}: {
  vendorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serviceName, setServiceName] = useState('');
  const [cost, setCost] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [renewalDate, setRenewalDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendorId) {
      setServiceName('');
      setCost('');
      setBillingCycle('monthly');
      setStartDate(new Date().toISOString().slice(0, 10));
      setRenewalDate('');
      setError(null);
    }
  }, [vendorId]);

  async function handleSave() {
    if (!vendorId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          service_name: serviceName,
          cost: Number(cost),
          billing_cycle: billingCycle,
          start_date: startDate,
          renewal_date: renewalDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save subscription.');
        return;
      }
      onSaved();
    } catch {
      setError('Network error while saving the subscription.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!vendorId}
      onClose={onClose}
      title="Add Subscription"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!serviceName.trim() || !cost}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="text-xs text-muted mb-1 block">Service Name *</label>
          <input className={inputClass} value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Cost *</label>
            <input className={inputClass} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Billing Cycle</label>
            <select className={inputClass} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
              {BILLING_CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Start Date</label>
            <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Renewal Date</label>
            <input className={inputClass} type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
