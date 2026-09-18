'use client';

// ============================================================================
// LeadDetailClient — fetches a single lead + its activity timeline from the
// API (GET /api/leads/:id, GET /api/leads/:id/activities), and lets the
// user log activity, change stage inline, edit, or delete. All mutations
// still get re-checked server-side; this only shows controls a role is
// likely to be allowed to use.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, Mail, Phone, Globe, MapPin, Loader2, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeadForm } from '@/components/crm/lead-form';
import { LeadActivityTimeline, type ActivityRow } from '@/components/crm/lead-activity-timeline';
import { LeadActivityForm } from '@/components/crm/lead-activity-form';
import { OpportunityForm } from '@/components/crm/opportunity-form';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_BADGE_VARIANT,
  LEAD_PRIORITY_BADGE_VARIANT,
  OPPORTUNITY_STATUS_BADGE_VARIANT,
} from '@/lib/crm-constants';
import { formatCurrency, formatDate, capitalize } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { LEAD_PERMISSIONS, OPPORTUNITY_PERMISSIONS, CLIENT_PERMISSIONS } from '@/lib/rbac';
import type { Lead, LeadStage, Opportunity } from '@/types/database';

interface LeadDetail extends Lead {
  assigned_employee?: { id: string; full_name: string; employee_code: string } | null;
}

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { can, loading: authLoading } = usePermissions();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunityFormOpen, setOpportunityFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load this lead.');
        setLead(null);
        return;
      }
      setLead(data.lead);
    } catch {
      setErrorMsg('Network error while loading this lead.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`);
      const data = await res.json();
      if (res.ok) setActivities(data.activities ?? []);
    } finally {
      setActivitiesLoading(false);
    }
  }, [leadId]);

  const fetchOpportunities = useCallback(async () => {
    setOpportunitiesLoading(true);
    try {
      const res = await fetch(`/api/opportunities?lead_id=${leadId}`);
      const data = await res.json();
      if (res.ok) setOpportunities(data.opportunities ?? []);
    } finally {
      setOpportunitiesLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
    fetchActivities();
    fetchOpportunities();
  }, [fetchLead, fetchActivities, fetchOpportunities]);

  async function handleStageChange(newStage: LeadStage) {
    if (!lead || newStage === lead.stage) return;
    setStageSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (res.ok) {
        setLead(data.lead);
        fetchActivities(); // stage change auto-logs an activity
      }
    } finally {
      setStageSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this lead? This can be undone by an administrator.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/crm/leads');
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleConvert() {
    if (
      !confirm(
        `Convert ${lead?.company_name} to a client? This creates a client profile, carries over the primary contact, and opens a draft contract.`
      )
    )
      return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || 'Failed to convert this lead.');
        return;
      }
      router.push(`/clients/${data.client.id}`);
    } catch {
      setConvertError('Network error. Please try again.');
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading lead…
      </div>
    );
  }

  if (errorMsg || !lead) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/crm/leads')}>
          <ArrowLeft size={14} />
          Back to Leads
        </Button>
        <div className="card">
          <p className="text-sm text-danger">{errorMsg || 'Lead not found.'}</p>
        </div>
      </div>
    );
  }

  const canUpdate = can(LEAD_PERMISSIONS.UPDATE);
  const canDelete = can(LEAD_PERMISSIONS.DELETE);
  const canAssign = can(LEAD_PERMISSIONS.ASSIGN);
  const canCreateOpportunity = can(OPPORTUNITY_PERMISSIONS.CREATE);

  const infoItems: { label: string; value: string | null }[] = [
    { label: 'Country / City', value: [lead.country, lead.city].filter(Boolean).join(', ') || null },
    { label: 'Industry', value: lead.industry },
    { label: 'Campaign', value: lead.campaign },
    { label: 'Service Interested In', value: lead.service_interested },
    { label: 'Lead Value', value: lead.lead_value != null ? formatCurrency(lead.lead_value, lead.currency) : null },
    { label: 'Assigned To', value: lead.assigned_employee?.full_name ?? 'Unassigned' },
    { label: 'Last Contact', value: lead.last_contact_at ? formatDate(lead.last_contact_at) : null },
    { label: 'Next Follow-up', value: lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : null },
    { label: 'Created', value: formatDate(lead.created_at) },
  ];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.push('/crm/leads')}>
        <ArrowLeft size={14} />
        Back to Leads
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{lead.company_name}</h1>
            <Badge variant={LEAD_PRIORITY_BADGE_VARIANT[lead.priority]}>
              {capitalize(lead.priority)} priority
            </Badge>
          </div>
          <p className="text-sm text-muted mt-0.5">{lead.lead_code}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted">
            {lead.contact_person && <span>{lead.contact_person}</span>}
            {lead.email && (
              <span className="flex items-center gap-1.5">
                <Mail size={13} /> {lead.email}
              </span>
            )}
            {lead.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> {lead.phone}
              </span>
            )}
            {lead.website && (
              <span className="flex items-center gap-1.5">
                <Globe size={13} /> {lead.website}
              </span>
            )}
            {(lead.country || lead.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {[lead.city, lead.country].filter(Boolean).join(', ')}
              </span>
            )}
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
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {infoItems.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm text-white mt-0.5">{item.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <dt className="text-xs text-muted mb-1">Notes</dt>
                <dd className="text-sm text-white whitespace-pre-wrap">{lead.notes}</dd>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            {canUpdate && (
              <div className="mb-5">
                <LeadActivityForm
                  leadId={leadId}
                  onLogged={() => {
                    fetchActivities();
                    fetchLead();
                  }}
                />
              </div>
            )}
            <LeadActivityTimeline activities={activities} loading={activitiesLoading} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stage</CardTitle>
            </CardHeader>
            <Badge variant={LEAD_STAGE_BADGE_VARIANT[lead.stage]} className="mb-3">
              {LEAD_STAGE_LABELS[lead.stage]}
            </Badge>
            {canUpdate && (
              <select
                disabled={stageSaving}
                value={lead.stage}
                onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary disabled:opacity-60"
              >
                {LEAD_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            {can(CLIENT_PERMISSIONS.CREATE) && lead.stage !== 'lost' && (
              <div className="mt-3 pt-3 border-t border-border">
                {convertError && (
                  <p className="text-xs text-danger bg-danger/10 rounded-lg px-2.5 py-1.5 mb-2">
                    {convertError}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleConvert}
                  loading={converting}
                >
                  Convert to Client
                </Button>
                <p className="text-xs text-muted mt-2">
                  Creates a client profile, carries over the primary contact, and opens a draft
                  contract.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
            </CardHeader>
            {canCreateOpportunity && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-3"
                onClick={() => setOpportunityFormOpen(true)}
              >
                <Plus size={14} />
                New Opportunity
              </Button>
            )}
            {opportunitiesLoading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : opportunities.length === 0 ? (
              <p className="text-sm text-muted">No opportunities opened yet.</p>
            ) : (
              <ul className="space-y-3">
                {opportunities.map((opp) => (
                  <li key={opp.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white">{opp.name}</span>
                      <Badge variant={OPPORTUNITY_STATUS_BADGE_VARIANT[opp.status]}>
                        {capitalize(opp.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {formatCurrency(opp.value, opp.currency)} · {opp.probability_pct}% probability
                      {opp.expected_close_date && ` · closes ${formatDate(opp.expected_close_date)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <LeadForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setLead((prev) => ({ ...prev, ...updated }) as LeadDetail)}
        lead={lead}
        canAssign={canAssign}
      />

      <OpportunityForm
        open={opportunityFormOpen}
        onClose={() => setOpportunityFormOpen(false)}
        onSaved={() => fetchOpportunities()}
        leadId={lead.id}
        leadLabel={`${lead.company_name} (${lead.lead_code})`}
        canAssign={canAssign}
      />
    </div>
  );
}
