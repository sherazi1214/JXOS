// ============================================================================
// POST /api/ai — AI CEO/Sales/Finance/Operations Assistant (Module 21).
//
// READ-ONLY by design: this route builds a context block out of data the
// caller already has permission to see (each section gated by the same
// rbac.ts permission that governs its module, mirroring /api/dashboard),
// hands that + the conversation to askAssistant(), and returns text. There
// is no tool-calling/write path back into the database here, so the model
// has no way to mutate financial or payroll data — see ai-client.ts.
//
// RBAC: ai.use gates the endpoint itself; the *content* the assistant can
// see is further narrowed per-section by the caller's other permissions.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserWithRole } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, AI_PERMISSIONS } from '@/lib/rbac';
import { askAssistant, type ChatMessage } from '@/lib/ai-client';

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      })
    )
    .min(1)
    .max(20),
});

function startOfMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

async function buildContext(
  db: ReturnType<typeof supabaseServer>,
  permissions: string[]
): Promise<string> {
  const has = (code: string) => permissions.includes(code);
  const monthStart = startOfMonth();
  const today = new Date().toISOString().slice(0, 10);
  const sections: string[] = [];

  if (has('invoices.view_all') && has('payments.view')) {
    const [{ data: payments }, { data: openInvoices }] = await Promise.all([
      db.from('payments').select('amount').gte('payment_date', monthStart),
      db
        .from('invoices')
        .select('invoice_number, total_amount, due_date, status, payments(amount), client:clients(company_name)')
        .neq('status', 'cancelled')
        .is('deleted_at', null),
    ]);
    const revenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    let outstanding = 0;
    const overdue: string[] = [];
    for (const inv of openInvoices ?? []) {
      const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const balance = Number(inv.total_amount) - paid;
      if (balance > 0) outstanding += balance;
      if (balance > 0 && inv.due_date < today) {
        overdue.push(`${(inv as any).client?.company_name ?? 'Unknown'} owes $${balance.toFixed(2)} (invoice ${inv.invoice_number}, due ${inv.due_date})`);
      }
    }
    sections.push(
      `FINANCE: Revenue this month so far: $${revenue.toFixed(2)}. Outstanding receivables: $${outstanding.toFixed(2)}. Overdue invoices (${overdue.length}): ${overdue.slice(0, 10).join('; ') || 'none'}.`
    );
  }

  if (has('expenses.view')) {
    const { data: expenses } = await db
      .from('expenses')
      .select('amount, category:expense_categories(name)')
      .gte('expense_date', monthStart);
    const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    for (const e of expenses ?? []) {
      const name = (e as any).category?.name ?? 'Other';
      byCategory[name] = (byCategory[name] ?? 0) + Number(e.amount);
    }
    const topCats = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}: $${v.toFixed(2)}`)
      .join(', ');
    sections.push(`EXPENSES: Total this month: $${total.toFixed(2)}. Top categories: ${topCats || 'none'}.`);
  }

  if (has('leads.view_all') && has('opportunities.view_all')) {
    const [{ count: newLeads }, { data: closedOpps }, { data: openOpps }] = await Promise.all([
      db.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', monthStart),
      db.from('opportunities').select('status, value, owner:employees(full_name)').neq('status', 'open').gte('closed_at', monthStart),
      db.from('opportunities').select('value').eq('status', 'open'),
    ]);
    const won = (closedOpps ?? []).filter((o) => o.status === 'won');
    const lost = (closedOpps ?? []).filter((o) => o.status === 'lost');
    const bySalesperson: Record<string, number> = {};
    for (const o of won) {
      const name = (o as any).owner?.full_name ?? 'Unassigned';
      bySalesperson[name] = (bySalesperson[name] ?? 0) + Number(o.value);
    }
    const topSales = Object.entries(bySalesperson)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}: $${v.toFixed(2)} won`)
      .join(', ');
    sections.push(
      `SALES: New leads this month: ${newLeads ?? 0}. Deals won: ${won.length} ($${won.reduce((s, o) => s + Number(o.value), 0).toFixed(2)}). Deals lost: ${lost.length}. Open pipeline value: $${(openOpps ?? []).reduce((s, o) => s + Number(o.value), 0).toFixed(2)}. Top performers: ${topSales || 'none'}.`
    );
  }

  if (has('clients.view_all')) {
    const [{ count: active }, { count: newThisMonth }] = await Promise.all([
      db.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
      db.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('client_since', monthStart),
    ]);
    sections.push(`CLIENTS: Active clients: ${active ?? 0}. New clients this month: ${newThisMonth ?? 0}.`);
  }

  if (has('projects.view_all')) {
    const { data: projects } = await db
      .from('projects')
      .select('project_code, status, deadline, budget, revenue, client:clients(company_name)')
      .not('status', 'in', '(completed,cancelled)');
    const delayed = (projects ?? []).filter((p) => p.deadline && p.deadline < today);
    sections.push(
      `PROJECTS: Active projects: ${(projects ?? []).length}. Overdue/delayed: ${delayed.length} (${delayed
        .slice(0, 5)
        .map((p) => `${(p as any).client?.company_name ?? 'Unknown'} — ${p.project_code}`)
        .join(', ') || 'none'}).`
    );
  }

  if (has('employees.view_all')) {
    const { count: totalActive } = await db
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'active');
    sections.push(`EMPLOYEES: Total active headcount: ${totalActive ?? 0}.`);
  }

  return sections.length
    ? sections.join('\n\n')
    : 'No company data is currently visible to this user role.';
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(AI_PERMISSIONS.USE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid chat payload.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const context = await buildContext(db, permissions);

  const systemPrompt = `You are the Jasonex Technologies internal Business OS AI Assistant. You answer questions about the company's own data — revenue, sales, clients, expenses, projects, employees — using ONLY the CONTEXT block below, which was already filtered to what this user (role: ${user.roleName}) is permitted to see. Be concise and use concrete numbers from the context. If the context doesn't contain what's needed to answer, say so plainly and suggest which module has it — never invent numbers. You cannot take any action (you cannot edit records, approve payroll, or send messages) — you can only answer questions about existing data.

CONTEXT:
${context}`;

  try {
    const reply = await askAssistant(systemPrompt, parsed.data.messages as ChatMessage[]);
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'The AI Assistant is temporarily unavailable.' },
      { status: 502 }
    );
  }
}
