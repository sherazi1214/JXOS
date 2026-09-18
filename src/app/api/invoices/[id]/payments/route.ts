// ============================================================================
// POST /api/invoices/:id/payments  — record a payment against an invoice.
//                                     Automatically recalculates the
//                                     invoice's status from
//                                     total_amount − sum(payments):
//                                     'paid' once fully covered,
//                                     'partially_paid' otherwise. Outstanding
//                                     balance itself is never stored — it's
//                                     always derived (see db/schema.sql).
//
// RBAC: payments.create, plus invoices.view to read the parent invoice.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PAYMENT_PERMISSIONS, INVOICE_PERMISSIONS } from '@/lib/rbac';

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_date: z.string().optional(),
  payment_method: z.enum([
    'bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'online_wallet', 'other',
  ]),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYMENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from('payments')
    .select('*')
    .eq('invoice_id', resolvedParams.id)
    .order('payment_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load payments.' }, { status: 500 });
  }

  return NextResponse.json({ payments: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYMENT_PERMISSIONS.CREATE) || !permissions.includes(INVOICE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payment data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .select('id, client_id, currency, total_amount, status')
    .eq('id', resolvedParams.id)
    .is('deleted_at', null)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  if (invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record a payment on a cancelled invoice.' }, { status: 409 });
  }

  const { data: payment, error } = await db
    .from('payments')
    .insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      amount: input.amount,
      currency: invoice.currency,
      payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
      payment_method: input.payment_method,
      reference: input.reference || null,
      notes: input.notes || null,
      recorded_by: user.id,
    })
    .select('*')
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: 'Failed to record payment.' }, { status: 500 });
  }

  const { data: allPayments } = await db
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoice.id);

  const totalPaid = (allPayments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const newStatus = totalPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';

  await db
    .from('invoices')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invoice.id);

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'payment',
    entity_id: payment.id,
    new_value: payment,
  });

  return NextResponse.json({ payment, invoice_status: newStatus }, { status: 201 });
}
