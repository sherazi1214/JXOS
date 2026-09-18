// ============================================================================
// DELETE /api/payments/:id — void a recorded payment (e.g. it was logged in
//                             error, or a cheque bounced). Recalculates the
//                             parent invoice's status the same way recording
//                             a payment does, in reverse.
//
// RBAC: payments.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PAYMENT_PERMISSIONS } from '@/lib/rbac';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYMENT_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = supabaseServer();
  const { data: payment, error: paymentError } = await db
    .from('payments')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  }

  const { error: deleteError } = await db.from('payments').delete().eq('id', resolvedParams.id);
  if (deleteError) {
    return NextResponse.json({ error: 'Failed to void payment.' }, { status: 500 });
  }

  const { data: invoice } = await db
    .from('invoices')
    .select('id, total_amount, status')
    .eq('id', payment.invoice_id)
    .single();

  if (invoice && invoice.status !== 'cancelled') {
    const { data: remaining } = await db
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoice.id);

    const totalPaid = (remaining ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const newStatus =
      totalPaid <= 0 ? 'sent' : totalPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';

    await db
      .from('invoices')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', invoice.id);
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'payment',
    entity_id: resolvedParams.id,
    previous_value: payment,
  });

  return NextResponse.json({ success: true });
}
