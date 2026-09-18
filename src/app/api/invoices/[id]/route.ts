// ============================================================================
// GET    /api/invoices/:id  — fetch a single invoice with its line items
//                              and recorded payments
// PATCH  /api/invoices/:id  — update invoice header fields / status
//                              (mark sent/cancelled; line items are
//                              immutable once created — void and reissue
//                              instead of editing a sent invoice's items)
// DELETE /api/invoices/:id  — soft-delete an invoice
//
// RBAC: invoices.view / invoices.update / invoices.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, INVOICE_PERMISSIONS } from '@/lib/rbac';

const INVOICE_DETAIL_SELECT = `
  *,
  client:clients(id, company_name, client_code),
  contract:contracts(id, contract_code),
  invoice_items(*),
  payments(*)
`;

const updateInvoiceSchema = z.object({
  due_date: z.string().min(1).optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']).optional(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('invoices')
    .select(INVOICE_DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Invoice not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, existing } = ctx;

  if (!permissions.includes(INVOICE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ invoice: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(INVOICE_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid invoice data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.due_date && input.due_date < existing.invoice_date) {
    return NextResponse.json({ error: 'Due date cannot be before the invoice date.' }, { status: 400 });
  }

  const { data: updated, error } = await db
    .from('invoices')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(INVOICE_DETAIL_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update invoice.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'invoice',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(INVOICE_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if ((existing.payments ?? []).length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete an invoice that already has payments recorded against it.' },
      { status: 409 }
    );
  }

  const { error } = await db
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete invoice.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'invoice',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
