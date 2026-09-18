'use client';

// ============================================================================
// AssetsPageClient — interactive shell for /assets: filterable table,
// "Register Asset" modal, quick reassign/status update.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { ASSET_PERMISSIONS } from '@/lib/rbac';
import { ASSET_STATUSES, ASSET_STATUS_BADGE_VARIANT, ASSET_CONDITIONS, ASSET_TYPES } from '@/lib/asset-constants';

interface AssetRow {
  id: string;
  asset_code: string;
  asset_type: string;
  serial_number: string | null;
  purchase_cost: number | null;
  currency: string;
  condition: string;
  status: string;
  location: string | null;
  employee: { id: string; full_name: string } | null;
}

interface EmployeeOption {
  id: string;
  full_name: string;
}

const inputClass =
  'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary';

export function AssetsPageClient() {
  const { can, loading: authLoading } = usePermissions();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (status) params.set('status', status);
      const res = await fetch(`/api/assets?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load assets.');
        return;
      }
      setAssets(data.assets ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading assets.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    fetch('/api/employees?pageSize=200')
      .then((res) => (res.ok ? res.json() : { employees: [] }))
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => setEmployees([]));
  }, [formOpen]);

  async function handleReassign(assetId: string, employeeId: string) {
    try {
      await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: employeeId || null }),
      });
      fetchAssets();
    } catch {
      setErrorMsg('Failed to reassign asset.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Assets &amp; IT</h1>
          <p className="text-sm text-muted mt-0.5">{total} asset{total === 1 ? '' : 's'} registered</p>
        </div>
        {!authLoading && can(ASSET_PERMISSIONS.CREATE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Register Asset
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select className={inputClass + ' max-w-[200px]'} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Serial #</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableEmpty colSpan={7}>Loading assets…</TableEmpty>
            ) : assets.length === 0 ? (
              <TableEmpty colSpan={7}>No assets found.</TableEmpty>
            ) : (
              assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.asset_code}</TableCell>
                  <TableCell>{a.asset_type}</TableCell>
                  <TableCell>{a.serial_number || '—'}</TableCell>
                  <TableCell>
                    {can(ASSET_PERMISSIONS.UPDATE) ? (
                      <select
                        className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-white outline-none"
                        value={a.employee?.id ?? ''}
                        onChange={(e) => handleReassign(a.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      a.employee?.full_name || '—'
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{a.condition}</TableCell>
                  <TableCell>
                    <Badge variant={ASSET_STATUS_BADGE_VARIANT[a.status as keyof typeof ASSET_STATUS_BADGE_VARIANT] ?? 'default'}>
                      {ASSET_STATUSES.find((s) => s.value === a.status)?.label ?? a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.purchase_cost ? formatCurrency(a.purchase_cost, a.currency) : '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AssetFormModal
        open={formOpen}
        employees={employees}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          fetchAssets();
        }}
      />
    </div>
  );
}

function AssetFormModal({
  open,
  employees,
  onClose,
  onSaved,
}: {
  open: boolean;
  employees: EmployeeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assetType, setAssetType] = useState(ASSET_TYPES[0]);
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [condition, setCondition] = useState('new');
  const [assignedTo, setAssignedTo] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAssetType(ASSET_TYPES[0]);
      setSerialNumber('');
      setPurchaseCost('');
      setCondition('new');
      setAssignedTo('');
      setLocation('');
      setError(null);
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_type: assetType,
          serial_number: serialNumber || null,
          purchase_cost: purchaseCost ? Number(purchaseCost) : null,
          condition,
          assigned_to: assignedTo || null,
          location: location || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register asset.');
        return;
      }
      onSaved();
    } catch {
      setError('Network error while registering the asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register Asset"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Asset Type</label>
            <select className={inputClass} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Condition</label>
            <select className={inputClass} value={condition} onChange={(e) => setCondition(e.target.value)}>
              {ASSET_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Serial Number</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Purchase Cost</label>
            <input className={inputClass} type="number" min="0" step="0.01" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Location</label>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Assign To</label>
          <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
