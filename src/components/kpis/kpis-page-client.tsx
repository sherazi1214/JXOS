'use client';

// ============================================================================
// KpisPageClient — interactive shell for /kpis: target vs actual per metric,
// achievement %, "Set Target" modal, inline actual-value updates.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target, TrendingUp, TrendingDown, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table';
import { formatPercent } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { KPI_PERMISSIONS } from '@/lib/rbac';
import { KPI_PERIODS, COMMON_KPI_METRICS, achievementBadgeVariant } from '@/lib/kpi-constants';

interface Kpi {
  id: string;
  period_type: string;
  period_start: string;
  metric: string;
  target_value: number;
  actual_value: number;
  achievement_pct: number;
}

const inputClass =
  'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary';

function currentMonthFirst(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function KpisPageClient() {
  const { can, loading: authLoading } = usePermissions();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState('monthly');
  const [formOpen, setFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingActual, setEditingActual] = useState<Record<string, string>>({});

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period_type: periodType });
      const res = await fetch(`/api/kpis?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load KPIs.');
        return;
      }
      setKpis(data.kpis ?? []);
    } catch {
      setErrorMsg('Network error while loading KPIs.');
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  async function handleActualUpdate(id: string) {
    const value = editingActual[id];
    if (value === undefined) return;
    try {
      await fetch(`/api/kpis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_value: Number(value) }),
      });
      fetchKpis();
    } catch {
      setErrorMsg('Failed to update actual value.');
    }
  }

  const summary = useMemo(() => {
    if (kpis.length === 0) return { avg: 0, onTrack: 0, behind: 0 };
    const avg = kpis.reduce((s, k) => s + k.achievement_pct, 0) / kpis.length;
    const onTrack = kpis.filter((k) => k.achievement_pct >= 75).length;
    const behind = kpis.filter((k) => k.achievement_pct < 40).length;
    return { avg, onTrack, behind };
  }, [kpis]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Company Goals &amp; KPIs</h1>
          <p className="text-sm text-muted mt-0.5">Target vs. actual, achievement % = actual ÷ target × 100</p>
        </div>
        {!authLoading && can(KPI_PERMISSIONS.MANAGE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Set Target
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Avg. Achievement"
          value={kpis.length ? formatPercent(summary.avg) : '—'}
          icon={Target}
          tone="primary"
          hint={`${kpis.length} metric${kpis.length === 1 ? '' : 's'} tracked`}
        />
        <StatCard label="On Track" value={String(summary.onTrack)} icon={Trophy} tone="success" hint="≥ 75% of target" />
        <StatCard
          label="Behind Target"
          value={String(summary.behind)}
          icon={summary.behind > 0 ? TrendingDown : TrendingUp}
          tone={summary.behind > 0 ? 'danger' : 'success'}
          hint="< 40% of target"
        />
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select className={inputClass + ' max-w-[200px]'} value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
            {KPI_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Achievement</TableHead>
              {can(KPI_PERMISSIONS.MANAGE) && <TableHead>Update Actual</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableEmpty colSpan={6}>Loading KPIs…</TableEmpty>
            ) : kpis.length === 0 ? (
              <TableEmpty colSpan={6}>No targets set for this period yet.</TableEmpty>
            ) : (
              kpis.map((k) => {
                const pct = Math.max(0, Math.min(100, k.achievement_pct));
                const barColor =
                  k.achievement_pct >= 100
                    ? 'bg-success'
                    : k.achievement_pct >= 75
                    ? 'bg-primary'
                    : k.achievement_pct >= 40
                    ? 'bg-warning'
                    : 'bg-danger';
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.metric}</TableCell>
                    <TableCell>{k.period_start}</TableCell>
                    <TableCell>{k.target_value.toLocaleString()}</TableCell>
                    <TableCell>{k.actual_value.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <Badge variant={achievementBadgeVariant(k.achievement_pct)}>
                          {formatPercent(k.achievement_pct)}
                        </Badge>
                      </div>
                    </TableCell>
                    {can(KPI_PERMISSIONS.MANAGE) && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="w-24 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-white outline-none focus:border-primary"
                            placeholder={String(k.actual_value)}
                            value={editingActual[k.id] ?? ''}
                            onChange={(e) => setEditingActual((prev) => ({ ...prev, [k.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" onClick={() => handleActualUpdate(k.id)}>
                            Save
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <KpiFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          fetchKpis();
        }}
      />
    </div>
  );
}

function KpiFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [metric, setMetric] = useState(COMMON_KPI_METRICS[0]);
  const [periodType, setPeriodType] = useState('monthly');
  const [periodStart, setPeriodStart] = useState(currentMonthFirst());
  const [targetValue, setTargetValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMetric(COMMON_KPI_METRICS[0]);
      setPeriodType('monthly');
      setPeriodStart(currentMonthFirst());
      setTargetValue('');
      setError(null);
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric,
          period_type: periodType,
          period_start: periodStart,
          target_value: Number(targetValue),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save target.');
        return;
      }
      onSaved();
    } catch {
      setError('Network error while saving the target.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set Target"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!targetValue}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="text-xs text-muted mb-1 block">Metric</label>
          <input
            className={inputClass}
            list="kpi-metrics"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          />
          <datalist id="kpi-metrics">
            {COMMON_KPI_METRICS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Period Type</label>
            <select className={inputClass} value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
              {KPI_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Period Start</label>
            <input className={inputClass} type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Target Value</label>
          <input className={inputClass} type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
