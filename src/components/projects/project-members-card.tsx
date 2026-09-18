'use client';

// ============================================================================
// ProjectMembersCard — the project's team, with a picker (from the employee
// roster) to add someone and a remove action. Membership is what unlocks
// projects.view/tasks.view for an Employee without projects.view_all, so
// this list doubles as "who can see this project".
// ============================================================================

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

export interface ProjectMemberRow {
  employee_id: string;
  role_on_project: string | null;
  added_at: string;
  employee?: { id: string; full_name: string; employee_code: string } | null;
}

export function ProjectMembersCard({
  projectId,
  members,
  projectManagerId,
  canEdit,
  onChanged,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  projectManagerId: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [roster, setRoster] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) return;
    fetch('/api/employees?pageSize=100')
      .then((res) => (res.ok ? res.json() : { employees: [] }))
      .then((data) => setRoster(data.employees ?? []))
      .catch(() => setRoster([]));
  }, [adding]);

  const memberIds = new Set(members.map((m) => m.employee_id));
  const available = roster.filter((e) => !memberIds.has(e.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Pick an employee.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selected, role_on_project: role || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add team member.');
        return;
      }
      setSelected('');
      setRole('');
      setAdding(false);
      onChanged();
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(employeeId: string) {
    await fetch(`/api/projects/${projectId}/members/${employeeId}`, { method: 'DELETE' });
    onChanged();
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary placeholder:text-muted';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Add Member
          </Button>
        )}
      </CardHeader>

      {members.length === 0 && !adding && (
        <p className="text-sm text-muted">No team members yet.</p>
      )}

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.employee_id}
            className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
          >
            <div>
              <span className="text-sm text-white">
                {m.employee?.full_name || 'Employee'}
                {m.employee_id === projectManagerId && (
                  <span className="text-xs text-primary ml-1.5">(PM)</span>
                )}
              </span>
              {m.role_on_project && (
                <span className="block text-xs text-muted">{m.role_on_project}</span>
              )}
            </div>
            {canEdit && m.employee_id !== projectManagerId && (
              <button
                type="button"
                onClick={() => handleRemove(m.employee_id)}
                className="text-muted hover:text-danger p-1"
                aria-label="Remove team member"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2 border-t border-border pt-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <select
            className={inputClass}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select an employee…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="Role on project (optional, e.g. Developer)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Add
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
