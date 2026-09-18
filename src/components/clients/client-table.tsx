'use client';

// ============================================================================
// ClientTable — presentational table of clients. Same shape as LeadTable/
// OpportunityTable for consistency.
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
import { CLIENT_STATUS_BADGE_VARIANT } from '@/lib/client-constants';
import { capitalize, formatDate } from '@/lib/utils';
import type { Client } from '@/types/database';

export interface ClientRow extends Client {
  account_manager?: { id: string; full_name: string; employee_code: string } | null;
}

export function ClientTable({
  clients,
  loading,
  onRowClick,
}: {
  clients: ClientRow[];
  loading: boolean;
  onRowClick: (client: ClientRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Industry</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Account Manager</TableHead>
          <TableHead>Client Since</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={6}>Loading clients…</TableEmpty>
        ) : clients.length === 0 ? (
          <TableEmpty colSpan={6}>No clients match your filters.</TableEmpty>
        ) : (
          clients.map((client) => (
            <TableRow key={client.id} onClick={() => onRowClick(client)}>
              <TableCell>
                <span className="font-medium">{client.company_name}</span>
                <span className="block text-xs text-muted">{client.client_code}</span>
              </TableCell>
              <TableCell className="text-muted">{client.industry || '—'}</TableCell>
              <TableCell className="text-muted">{client.country || '—'}</TableCell>
              <TableCell>
                <Badge variant={CLIENT_STATUS_BADGE_VARIANT[client.status]}>
                  {capitalize(client.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted">
                {client.account_manager?.full_name || 'Unassigned'}
              </TableCell>
              <TableCell className="text-muted">{formatDate(client.client_since)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
