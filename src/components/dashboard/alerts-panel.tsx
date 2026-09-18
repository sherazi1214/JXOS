'use client';

// ============================================================================
// AlertsPanel — CEO Dashboard alerts widget: overdue invoices, contracts
// expiring within 30 days, and leads whose follow-up is due — each list
// only appears if the underlying GET /api/dashboard section was populated
// (i.e. the caller has permission for that module). Empty overall when the
// caller can see none of the three, or when nothing is actually overdue.
// ============================================================================

import Link from 'next/link';
import { AlertTriangle, FileClock, UserCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface AlertsData {
  overdueInvoices: { count: number; total: number; items: { id: string; invoice_number: string; amount: number; due_date: string }[] } | null;
  expiringContracts: { id: string; contract_code: string; client_id: string; end_date: string; client?: { company_name: string } | null }[] | null;
  followUpsDue: { count: number; items: { id: string; company_name: string; next_follow_up_at: string; assigned_to?: { full_name: string } | null }[] } | null;
}

function AlertRow({ icon, text, sub, href }: { icon: React.ReactNode; text: string; sub?: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-1 py-2 rounded-lg hover:bg-white/[0.03] transition-colors -mx-1"
    >
      <div className="text-warning mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{text}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </Link>
  );
}

export function AlertsPanel({ data }: { data: AlertsData }) {
  const hasOverdueInvoices = (data.overdueInvoices?.items.length ?? 0) > 0;
  const hasExpiringContracts = (data.expiringContracts?.length ?? 0) > 0;
  const hasFollowUps = (data.followUpsDue?.items.length ?? 0) > 0;
  const nothingToShow = !hasOverdueInvoices && !hasExpiringContracts && !hasFollowUps;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>

      {nothingToShow ? (
        <p className="text-sm text-muted">Nothing needs attention right now.</p>
      ) : (
        <div className="divide-y divide-border">
          {hasOverdueInvoices &&
            data.overdueInvoices!.items.map((inv) => (
              <AlertRow
                key={inv.id}
                icon={<AlertTriangle size={16} />}
                text={`${inv.invoice_number} is overdue`}
                sub={`${formatCurrency(inv.amount)} · due ${formatDate(inv.due_date)}`}
                href="/finance/invoices"
              />
            ))}

          {hasExpiringContracts &&
            data.expiringContracts!.map((c) => (
              <AlertRow
                key={c.id}
                icon={<FileClock size={16} />}
                text={`${c.contract_code} expires ${formatDate(c.end_date)}`}
                sub={c.client?.company_name}
                href={`/contracts?client_id=${c.client_id}`}
              />
            ))}

          {hasFollowUps &&
            data.followUpsDue!.items.map((lead) => (
              <AlertRow
                key={lead.id}
                icon={<UserCheck size={16} />}
                text={`Follow-up due — ${lead.company_name}`}
                sub={lead.assigned_to?.full_name ? `Assigned to ${lead.assigned_to.full_name}` : undefined}
                href={`/crm/leads/${lead.id}`}
              />
            ))}
        </div>
      )}
    </Card>
  );
}
