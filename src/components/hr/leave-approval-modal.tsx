'use client';

// ============================================================================
// LeaveApprovalModal — shows one leave request's detail with Approve/Reject
// actions (leave.approve), or a Withdraw action if the viewer owns a still-
// pending request. Approving also back-fills attendance for the date range
// (see PATCH /api/leave/:id).
// ============================================================================

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LEAVE_STATUS_BADGE_VARIANT, LEAVE_TYPES } from '@/lib/hr-constants';
import { formatDate } from '@/lib/utils';
import type { LeaveRow } from '@/components/hr/leave-table';

export function LeaveApprovalModal({
  open,
  onClose,
  onChanged,
  request,
  canApprove,
  canWithdraw,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  request: LeaveRow | null;
  canApprove: boolean;
  canWithdraw: boolean;
}) {
  const [submitting, setSubmitting] = useState<'approved' | 'rejected' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  async function act(status: 'approved' | 'rejected' | 'cancelled') {
    setSubmitting(status);
    setError(null);
    try {
      const res = await fetch(`/api/leave/${request!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      onChanged();
      onClose();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(null);
    }
  }

  const leaveTypeLabel = LEAVE_TYPES.find((t) => t.value === request.leave_type)?.label ?? request.leave_type;
  const isPending = request.status === 'pending';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leave Request"
      footer={
        isPending ? (
          <>
            {canWithdraw && (
              <Button variant="ghost" onClick={() => act('cancelled')} loading={submitting === 'cancelled'}>
                Withdraw
              </Button>
            )}
            {canApprove && (
              <>
                <Button variant="danger" onClick={() => act('rejected')} loading={submitting === 'rejected'}>
                  Reject
                </Button>
                <Button onClick={() => act('approved')} loading={submitting === 'approved'}>
                  Approve
                </Button>
              </>
            )}
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{request.employee?.full_name || 'You'}</p>
            <p className="text-xs text-muted">{leaveTypeLabel} leave</p>
          </div>
          <Badge variant={LEAVE_STATUS_BADGE_VARIANT[request.status]}>{request.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted mb-1">Dates</p>
            <p className="text-white">
              {formatDate(request.start_date)} – {formatDate(request.end_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Days</p>
            <p className="text-white">{request.days_count}</p>
          </div>
        </div>

        {request.reason && (
          <div>
            <p className="text-xs text-muted mb-1">Reason</p>
            <p className="text-sm text-white">{request.reason}</p>
          </div>
        )}

        {request.approver && (
          <p className="text-xs text-muted">
            {request.status === 'approved' ? 'Approved' : 'Reviewed'} by {request.approver.full_name}
          </p>
        )}
      </div>
    </Modal>
  );
}
