'use client';

// ============================================================================
// CandidateTable — presentational table of the recruitment pipeline. Same
// shape as EmployeeTable/LeadTable for consistency across modules.
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
import { RECRUITMENT_STAGE_BADGE_VARIANT, RECRUITMENT_STAGE_LABELS } from '@/lib/recruitment-constants';
import { formatDate } from '@/lib/utils';
import type { Candidate } from '@/types/database';

export interface CandidateRow extends Candidate {
  department?: { id: string; name: string } | null;
}

export function CandidateTable({
  candidates,
  loading,
  onRowClick,
}: {
  candidates: CandidateRow[];
  loading: boolean;
  onRowClick: (candidate: CandidateRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidate</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Applied</TableHead>
          <TableHead>Stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={6}>Loading candidates…</TableEmpty>
        ) : candidates.length === 0 ? (
          <TableEmpty colSpan={6}>No candidates match your filters.</TableEmpty>
        ) : (
          candidates.map((candidate) => (
            <TableRow key={candidate.id} onClick={() => onRowClick(candidate)}>
              <TableCell>
                <span className="font-medium">{candidate.full_name}</span>
                <span className="block text-xs text-muted">{candidate.email || candidate.phone || '—'}</span>
              </TableCell>
              <TableCell className="text-muted">{candidate.position_title}</TableCell>
              <TableCell className="text-muted">{candidate.department?.name || '—'}</TableCell>
              <TableCell className="text-muted">{candidate.source || '—'}</TableCell>
              <TableCell className="text-muted whitespace-nowrap">{formatDate(candidate.application_date)}</TableCell>
              <TableCell>
                <Badge variant={RECRUITMENT_STAGE_BADGE_VARIANT[candidate.stage]}>
                  {RECRUITMENT_STAGE_LABELS[candidate.stage]}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
