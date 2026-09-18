'use client';

// ============================================================================
// Team & Access — lets a CEO/Admin create additional login accounts scoped
// to a single role (Finance, HR, Sales Manager, ...) and suspend/restore
// them. This is what actually creates the "Finance login only works in
// Finance" behaviour: every account below is checked against rbac.ts on
// every request, the same way the CEO/Admin account already is.
// ============================================================================

import { useState } from 'react';
import { UserPlus, ShieldCheck, ShieldOff, Loader2, Mail, Lock, User as UserIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';

interface RoleOption {
  id: string;
  name: string;
}

interface TeamUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  role: { id: string; name: string } | null;
}

export function TeamAccessClient({
  initialUsers,
  roles,
  currentUserId,
}: {
  initialUsers: TeamUser[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<TeamUser[]>(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  function resetForm() {
    setFullName('');
    setEmail('');
    setPassword('');
    setRoleId(roles[0]?.id ?? '');
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password, role_id: roleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create user.');
        return;
      }
      setUsers((prev) => [data.user, ...prev]);
      setModalOpen(false);
      resetForm();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: TeamUser) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: data.user.is_active } : u)));
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Team &amp; Access</CardTitle>
          <p className="text-xs text-muted mt-1">
            Every login below is locked to one role — a Finance account only ever gets Finance
            permissions, checked on every request, the same way this admin account is.
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <UserPlus size={14} />
          Add user
        </Button>
      </CardHeader>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && <TableEmpty colSpan={6}>No team members yet.</TableEmpty>}
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.full_name}</TableCell>
              <TableCell className="text-muted">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role?.name === 'CEO/Admin' ? 'primary' : 'default'}>
                  {user.role?.name ?? 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.is_active ? 'success' : 'muted'}>
                  {user.is_active ? 'Active' : 'Suspended'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted">{formatDate(user.created_at)}</TableCell>
              <TableCell>
                {user.id !== currentUserId && (
                  <Button
                    size="sm"
                    variant={user.is_active ? 'danger' : 'outline'}
                    onClick={() => toggleActive(user)}
                    disabled={togglingId === user.id}
                  >
                    {togglingId === user.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : user.is_active ? (
                      <ShieldOff size={13} />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    {user.is_active ? 'Suspend' : 'Restore'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Add a team member"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form" loading={submitting}>
              Create account
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4" id="create-user-form">
          <div>
            <label className="block text-xs text-muted mb-1.5">Full name</label>
            <div className="relative">
              <UserIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field pl-10"
                placeholder="e.g. Ayesha Khan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="finance@jasonextechnologies.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Temporary password</label>
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="input-field appearance-none"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id} className="bg-surface">
                  {role.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1.5">
              This account will only ever see and edit what the {roles.find((r) => r.id === roleId)?.name ?? 'selected'} role has access to.
            </p>
          </div>

          {formError && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </Card>
  );
}
