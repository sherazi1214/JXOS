// ============================================================================
// GET   /api/notifications  — list the signed-in user's own in-app
//                              notifications, most recent first, plus an
//                              unread count. No RBAC permission gate beyond
//                              being authenticated — notifications are
//                              always scoped to the caller's own user_id,
//                              never another user's.
// PATCH /api/notifications  — mark one notification read ({ id }), or all
//                              of them ({ all: true }).
//
// Rows are written by other modules as business events happen (e.g. a lead
// assigned to a salesperson, an invoice going overdue) — this route only
// ever reads/updates, it never creates notifications itself.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';

const LIST_LIMIT = 30;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const db = supabaseServer();

  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }

  const { count: unreadCount } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('channel', 'in_app')
    .is('read_at', null);

  return NextResponse.json({ notifications: data, unread_count: unreadCount ?? 0 });
}

const markReadSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Pass { id: "<uuid>" } or { all: true }.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const now = new Date().toISOString();

  if ('all' in parsed.data) {
    const { error } = await db
      .from('notifications')
      .update({ status: 'read', read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to mark notifications read.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Marking a single notification read — scoped to the caller's own
  // user_id so one user can never mark another user's notification.
  const { data: updated, error } = await db
    .from('notifications')
    .update({ status: 'read', read_at: now })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }

  return NextResponse.json({ notification: updated });
}
