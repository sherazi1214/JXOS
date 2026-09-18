'use client';

// ============================================================================
// ContractTable — presentational table of contracts. Same shape as
// ClientTable/LeadTable for consistency.
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
import { CONTRACT_STATUS_BADGE_VARIANT } from '@/lib/client-constants';
import { capitalize, formatCurrency, formatDate } from '@/lib/utils';
import type { Contract } from '@/types/database';

export interface ContractRow extends Contract {
  client?: { id: string; company_name: string; client_code: string } | null;
  service?: { id: string; name: string } | null;
  assigned_team_lead?: { id: string; full_name: string; employee_code: string } | null;
}

export function ContractTable({
  contracts,
  loading,
  onRowClick,
}: {
  contracts: ContractRow[];
  loading: boolean;
  onRowClick: (contract: ContractRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contract</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Term</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={6}>Loading contracts…</TableEmpty>
        ) : contracts.length === 0 ? (
          <TableEmpty colSpan={6}>No contracts match your filters.</TableEmpty>
        ) : (
          contracts.map((contract) => (
            <TableRow key={contract.id} onClick={() => onRowClick(contract)}>
              <TableCell>
                <span className="font-medium">{contract.contract_code}</span>
              </TableCell>
              <TableCell className="text-muted">
                {contract.client?.company_name || '—'}
              </TableCell>
              <TableCell className="text-muted">{contract.service?.name || '—'}</TableCell>
              <TableCell className="text-muted">
                {formatCurrency(contract.contract_value, contract.currency)}
                {contract.monthly_recurring_amt > 0 && (
                  <span className="block text-xs">
                    {formatCurrency(contract.monthly_recurring_amt, contract.currency)}/mo
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted">
                {formatDate(contract.start_date)}
                {contract.end_date ? ` – ${formatDate(contract.end_date)}` : ' – ongoing'}
              </TableCell>
              <TableCell>
                <Badge variant={CONTRACT_STATUS_BADGE_VARIANT[contract.status]}>
                  {capitalize(contract.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
