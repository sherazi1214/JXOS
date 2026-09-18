// ============================================================================
// /settings — CEO/Admin-only. Read-only overview of roles & how many
// permissions each holds (RBAC, section 5/23), plus the signed-in admin's
// own account details. Full role/permission editing is a natural Phase 2
// extension of this page once the underlying admin API routes exist —
// today's `role_permissions` table is seeded via the db/migrations/*.sql
// files, not edited at runtime.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { TeamAccessClient } from '@/components/settings/team-access-client';

export default async function SettingsPage() {
  const user = await getCurrentUserWithRole();

  if (!user || user.roleName !== 'CEO/Admin') {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Settings is available to CEO/Admin accounts only.
        </p>
      </div>
    );
  }

  const db = supabaseServer();
  const { data: roles } = await db
    .from('roles')
    .select('id, name, description, is_system, role_permissions(count)')
    .order('name');

  const { count: totalPermissions } = await db
    .from('permissions')
    .select('id', { count: 'exact', head: true });

  const { data: teamUsersRaw } = await db
    .from('users')
    .select('id, full_name, email, is_active, created_at, role_id, roles(id, name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const teamUsers = (teamUsersRaw ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    is_active: row.is_active,
    created_at: row.created_at,
    role: row.roles ? { id: row.roles.id, name: row.roles.name } : null,
  }));

  const roleOptions = (roles ?? []).map((r: any) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-brand-gradient-soft px-5 py-5 animate-fade-in-up">
        <div className="aurora-blob -top-10 -right-10 h-40 w-40 bg-accent/20" />
        <div className="relative">
          <h1 className="font-display text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-muted mt-0.5">
            Company &amp; role administration. {totalPermissions ?? 0} permission codes defined across{' '}
            {roles?.length ?? 0} roles.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd className="text-white">{user.full_name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-white">{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="text-white">{user.roleName}</dd>
          <dt className="text-muted">Account created</dt>
          <dd className="text-white">{formatDate(user.created_at)}</dd>
        </dl>
      </Card>

      <TeamAccessClient initialUsers={teamUsers} roles={roleOptions} currentUserId={user.id} />

      <Card>
        <CardHeader>
          <CardTitle>Roles &amp; Permissions</CardTitle>
        </CardHeader>
        <p className="text-xs text-muted mb-3">
          Permissions are enforced server-side on every API route (see rbac.ts) — this table is
          read-only; role grants are seeded via the SQL migrations in{' '}
          <code className="text-white/80">db/migrations/</code>.
        </p>
        <div className="divide-y divide-border">
          {(roles ?? []).map((role: any) => (
            <div key={role.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm text-white font-medium">{role.name}</p>
                {role.description && <p className="text-xs text-muted mt-0.5">{role.description}</p>}
              </div>
              <Badge variant="primary">
                {role.role_permissions?.[0]?.count ?? 0} permission{(role.role_permissions?.[0]?.count ?? 0) === 1 ? '' : 's'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Company name</dt>
          <dd className="text-white">Jasonex Technologies</dd>
          <dt className="text-muted">Internal system</dt>
          <dd className="text-white">Jasonex OS (app.jasonextechnologies.com)</dd>
        </dl>
      </Card>
    </div>
  );
}
