'use client';

// ============================================================================
// OpportunityTable — presentational table of opportunities, grouped
// visually by status badge. Row click opens the edit modal (handled by the
// parent orchestrator), same pattern as LeadTable.
// ============================================================================

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
import { OPPORTUNITY_STATUS_BADGE_VARIANT } from '@/lib/crm-constants';
import { formatCurrency, formatDate, capitalize } from '@/lib/utils';
import type { Opportunity } from '@/types/database';

export interface OpportunityRow extends Opportunity {
  lead?: { id: string; company_name: string; lead_code: string } | null;
  owner?: { id: string; full_name: string; employee_code: string } | null;
}

export function OpportunityTable({
  opportunities,
  loading,
  onRowClick,
}: {
  opportunities: OpportunityRow[];
  loading: boolean;
  onRowClick: (opportunity: OpportunityRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Opportunity</TableHead>
          <TableHead>Lead</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Probability</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Expected Close</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={7}>Loading opportunities…</TableEmpty>
        ) : opportunities.length === 0 ? (
          <TableEmpty colSpan={7}>No opportunities match your filters.</TableEmpty>
        ) : (
          opportunities.map((opp) => (
            <TableRow key={opp.id} onClick={() => onRowClick(opp)}>
              <TableCell className="font-medium">{opp.name}</TableCell>
              <TableCell className="text-muted">
                {opp.lead?.company_name || '—'}
                {opp.lead?.lead_code && (
                  <span className="block text-xs text-muted">{opp.lead.lead_code}</span>
                )}
              </TableCell>
              <TableCell>{formatCurrency(opp.value, opp.currency)}</TableCell>
              <TableCell className="text-muted">{opp.probability_pct}%</TableCell>
              <TableCell>
                <Badge variant={OPPORTUNITY_STATUS_BADGE_VARIANT[opp.status]}>
                  {capitalize(opp.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted">{opp.owner?.full_name || 'Unassigned'}</TableCell>
              <TableCell className="text-muted">
                {opp.expected_close_date ? formatDate(opp.expected_close_date) : '—'}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
