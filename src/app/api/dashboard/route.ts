// ============================================================================
// GET /api/dashboard — executive overview data for Module 1 (CEO/Executive
// Dashboard). Each section is independently gated by the permission that
// already governs its underlying module, and is simply omitted (rather
// than erroring) when the caller lacks it — so a Sales Manager gets the
// Sales section without Finance numbers, a Salesperson without view_all
// gets nothing back but the page still renders, etc. There is no separate
// "dashboard.view" permission: seeing a widget here never grants any
// visibility the person didn't already have via the module itself.
//
// Aggregation happens in JS for the same reason as /api/reports/finance —
// Supabase's JS client can't express GROUP BY, and this is fine at ERP
// data volumes.
// ============================================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import {
  getPermissionsForRole,
  INVOICE_PERMISSIONS,
  PAYMENT_PERMISSIONS,
  EXPENSE_PERMISSIONS,
  LEAD_PERMISSIONS,
  OPPORTUNITY_PERMISSIONS,
  CLIENT_PERMISSIONS,
  CONTRACT_PERMISSIONS,
  EMPLOYEE_PERMISSIONS,
  ATTENDANCE_PERMISSIONS,
} from '@/lib/rbac';

function startOfMonth(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function startOfLastMonth(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function growthPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  const has = (code: string) => permissions.includes(code);

  const db = supabaseServer();
  const monthStart = startOfMonth();
  const lastMonthStart = startOfLastMonth();
  const today = todayStr();

  const canFinance = has(INVOICE_PERMISSIONS.VIEW_ALL) && has(PAYMENT_PERMISSIONS.VIEW);
  const canExpenses = has(EXPENSE_PERMISSIONS.VIEW);
  const canSales = has(LEAD_PERMISSIONS.VIEW_ALL) && has(OPPORTUNITY_PERMISSIONS.VIEW_ALL);
  const canClients = has(CLIENT_PERMISSIONS.VIEW_ALL);
  const canContracts = has(CONTRACT_PERMISSIONS.VIEW_ALL);
  const canEmployees = has(EMPLOYEE_PERMISSIONS.VIEW_ALL);
  const canAttendance = has(ATTENDANCE_PERMISSIONS.VIEW_ALL);

  const [revenue, sales, clients, employees, contractAlerts] = await Promise.all([
    canFinance ? loadRevenue(db, monthStart, lastMonthStart, today, canExpenses) : null,
    canSales ? loadSales(db, monthStart) : null,
    canClients ? loadClients(db, monthStart) : null,
    canEmployees ? loadEmployees(db, today, canAttendance) : null,
    canContracts ? loadExpiringContracts(db, today) : null,
  ]);

  return NextResponse.json({
    revenue,
    sales,
    clients,
    employees,
    alerts: {
      overdueInvoices: revenue?.overdueInvoices ?? null,
      expiringContracts: contractAlerts,
      followUpsDue: sales?.followUpsDue ?? null,
    },
  });
}

async function loadRevenue(
  db: ReturnType<typeof supabaseServer>,
  monthStart: string,
  lastMonthStart: string,
  today: string,
  canExpenses: boolean
) {
  const [{ data: thisMonthPayments }, { data: lastMonthPayments }, { data: openInvoices }, { data: thisMonthExpenses }] =
    await Promise.all([
      db.from('payments').select('amount').gte('payment_date', monthStart),
      db
        .from('payments')
        .select('amount')
        .gte('payment_date', lastMonthStart)
        .lt('payment_date', monthStart),
      db
        .from('invoices')
        .select('id, invoice_number, total_amount, due_date, status, payments(amount)')
        .is('deleted_at', null)
        .neq('status', 'cancelled'),
      canExpenses
        ? db.from('expenses').select('amount').gte('expense_date', monthStart)
        : Promise.resolve({ data: [] as { amount: number }[] }),
    ]);

  const thisMonthRevenue = (thisMonthPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const lastMonthRevenue = (lastMonthPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  let outstandingReceivables = 0;
  const overdue: { id: string; invoice_number: string; amount: number; due_date: string }[] = [];
  for (const inv of openInvoices ?? []) {
    const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number(inv.total_amount) - paid);
    outstandingReceivables += balance;
    if (balance > 0 && inv.due_date < today) {
      overdue.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: balance,
        due_date: inv.due_date,
      });
    }
  }
  overdue.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  const thisMonthExpensesTotal = (thisMonthExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return {
    thisMonthRevenue,
    lastMonthRevenue,
    growthPct: growthPct(thisMonthRevenue, lastMonthRevenue),
    outstandingReceivables,
    thisMonthExpenses: canExpenses ? thisMonthExpensesTotal : null,
    netProfit: canExpenses ? thisMonthRevenue - thisMonthExpensesTotal : null,
    overdueInvoices: { count: overdue.length, total: overdue.reduce((s, i) => s + i.amount, 0), items: overdue.slice(0, 5) },
  };
}

async function loadSales(db: ReturnType<typeof supabaseServer>, monthStart: string) {
  const nowIso = new Date().toISOString();

  const [
    { count: newLeadsCount },
    { data: closedOpps },
    { data: openOpps },
    { count: followUpsCount },
    { data: followUpItems },
  ] = await Promise.all([
    db.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', monthStart),
    db.from('opportunities').select('status, value, closed_at').neq('status', 'open').gte('closed_at', monthStart),
    db.from('opportunities').select('value').eq('status', 'open'),
    db
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', nowIso)
      .not('stage', 'in', '(won,lost)'),
    db
      .from('leads')
      .select('id, company_name, next_follow_up_at, assigned_to:employees(full_name)')
      .is('deleted_at', null)
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', nowIso)
      .not('stage', 'in', '(won,lost)')
      .order('next_follow_up_at', { ascending: true })
      .limit(5),
  ]);

  const won = (closedOpps ?? []).filter((o) => o.status === 'won');
  const lost = (closedOpps ?? []).filter((o) => o.status === 'lost');
  const wonValue = won.reduce((s, o) => s + Number(o.value), 0);
  const conversionRate =
    won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 1000) / 10
      : null;

  return {
    newLeadsThisMonth: newLeadsCount ?? 0,
    wonThisMonth: { count: won.length, value: wonValue },
    lostThisMonth: lost.length,
    conversionRate,
    openPipelineValue: (openOpps ?? []).reduce((s, o) => s + Number(o.value), 0),
    followUpsDue: { count: followUpsCount ?? 0, items: followUpItems ?? [] },
  };
}

async function loadClients(db: ReturnType<typeof supabaseServer>, monthStart: string) {
  const [{ count: activeCount }, { count: newCount }] = await Promise.all([
    db.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
    db.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('client_since', monthStart),
  ]);

  return { activeClients: activeCount ?? 0, newClientsThisMonth: newCount ?? 0 };
}

async function loadEmployees(db: ReturnType<typeof supabaseServer>, today: string, canAttendance: boolean) {
  const { count: totalActive } = await db
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'active');

  if (!canAttendance) {
    return { totalActive: totalActive ?? 0, attendanceToday: null };
  }

  const { data: todayRecords } = await db
    .from('attendance')
    .select('status')
    .eq('attendance_date', today);

  const tally = { present: 0, late: 0, absent: 0, leave: 0, half_day: 0, holiday: 0 };
  for (const r of todayRecords ?? []) {
    if (r.status in tally) (tally as any)[r.status] += 1;
  }
  const checkedIn = tally.present + tally.late + tally.half_day;

  return {
    totalActive: totalActive ?? 0,
    attendanceToday: { ...tally, checkedIn, notYetMarked: Math.max(0, (totalActive ?? 0) - (todayRecords?.length ?? 0)) },
  };
}

async function loadExpiringContracts(db: ReturnType<typeof supabaseServer>, today: string) {
  const { data } = await db
    .from('contracts')
    .select('id, contract_code, client_id, end_date, client:clients(company_name)')
    .is('deleted_at', null)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .gte('end_date', today)
    .lte('end_date', daysFromNow30(today))
    .order('end_date', { ascending: true })
    .limit(5);

  return data ?? [];
}

function daysFromNow30(today: string): string {
  const d = new Date(today);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
