'use client';

// ============================================================================
// LeadTable — presentational table of leads. Purely display + row click;
// all data-fetching, filtering, and mutation lives in the page/orchestrator
// component so this stays easy to reuse (e.g. inside a "my overdue
// follow-ups" widget on the salesperson dashboard later).
// ============================================================================

import { AlertCircle } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LEAD_STAGE_LABELS,
  LEAD_STAGE_BADGE_VARIANT,
  LEAD_PRIORITY_BADGE_VARIANT,
} from '@/lib/crm-constants';
import { formatCurrency, formatDate, capitalize } from '@/lib/utils';
import type { Lead } from '@/types/database';

export interface LeadRow extends Lead {
  assigned_employee?: { id: string; full_name: string; employee_code: string } | null;
}

function isOverdue(lead: LeadRow): boolean {
  if (!lead.next_follow_up_at) return false;
  if (lead.stage === 'won' || lead.stage === 'lost') return false;
  return new Date(lead.next_follow_up_at).getTime() < Date.now();
}

export function LeadTable({
  leads,
  loading,
  onRowClick,
}: {
  leads: LeadRow[];
  loading: boolean;
  onRowClick: (lead: LeadRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Next Follow-up</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={8}>Loading leads…</TableEmpty>
        ) : leads.length === 0 ? (
          <TableEmpty colSpan={8}>No leads match your filters.</TableEmpty>
        ) : (
          leads.map((lead) => (
            <TableRow key={lead.id} onClick={() => onRowClick(lead)}>
              <TableCell>
                <span className="font-medium">{lead.company_name}</span>
                <span className="block text-xs text-muted">{lead.lead_code}</span>
              </TableCell>
              <TableCell>
                <span className="block">{lead.contact_person || '—'}</span>
                <span className="block text-xs text-muted">{lead.email || lead.phone || ''}</span>
              </TableCell>
              <TableCell className="text-muted">{lead.source}</TableCell>
              <TableCell>
                <Badge variant={LEAD_STAGE_BADGE_VARIANT[lead.stage]}>
                  {LEAD_STAGE_LABELS[lead.stage]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={LEAD_PRIORITY_BADGE_VARIANT[lead.priority]}>
                  {capitalize(lead.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                {lead.lead_value != null ? formatCurrency(lead.lead_value, lead.currency) : '—'}
              </TableCell>
              <TableCell className="text-muted">
                {lead.assigned_employee?.full_name || 'Unassigned'}
              </TableCell>
              <TableCell>
                {lead.next_follow_up_at ? (
                  <span
                    className={
                      isOverdue(lead) ? 'flex items-center gap-1.5 text-danger' : 'text-muted'
                    }
                  >
                    {isOverdue(lead) && <AlertCircle size={13} />}
                    {formatDate(lead.next_follow_up_at)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
