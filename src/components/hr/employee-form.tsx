'use client';

// ============================================================================
// EmployeeForm — modal to add a new employee or edit an existing one.
// Department is picked from the departments catalog with an inline
// "+ New" affordance, same pattern as ExpenseForm's category picker.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { EMPLOYMENT_TYPES, EMPLOYEE_STATUSES } from '@/lib/hr-constants';
import type { Employee, Department } from '@/types/database';
import type { EmployeeRow } from '@/components/hr/employee-table';

interface EmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  employee?: EmployeeRow | null;
}

export function EmployeeForm({ open, onClose, onSaved, employee }: EmployeeFormProps) {
  const isEdit = Boolean(employee);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [employmentType, setEmploymentType] = useState<Employee['employment_type']>('full_time');
  const [baseSalary, setBaseSalary] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState<Employee['status']>('active');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadDepartments() {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewDepartment('');
    setAddingDepartment(false);
    loadDepartments();

    if (employee) {
      setFullName(employee.full_name);
      setEmail(employee.email);
      setPhone(employee.phone || '');
      setDepartmentId(employee.department_id || '');
      setDesignation(employee.designation || '');
      setJoiningDate(employee.joining_date);
      setEmploymentType(employee.employment_type);
      setBaseSalary(String(employee.base_salary));
      setCurrency(employee.currency);
      setStatus(employee.status);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setDepartmentId('');
      setDesignation('');
      setJoiningDate(new Date().toISOString().slice(0, 10));
      setEmploymentType('full_time');
      setBaseSalary('');
      setCurrency('USD');
      setStatus('active');
    }
  }, [open, employee]);

  async function handleAddDepartment() {
    if (!newDepartment.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDepartment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add department.');
        return;
      }
      setDepartments((prev) => [...prev, data.department].sort((a, b) => a.name.localeCompare(b.name)));
      setDepartmentId(data.department.id);
      setNewDepartment('');
      setAddingDepartment(false);
    } catch {
      setError('Network error while adding the department.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !joiningDate) {
      setError('Full name, email and joining date are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        department_id: departmentId || null,
        designation: designation.trim() || null,
        joining_date: joiningDate,
        employment_type: employmentType,
        base_salary: Number(baseSalary) || 0,
        currency,
        status,
      };

      const res = await fetch(isEdit ? `/api/employees/${employee!.id}` : '/api/employees', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.employee);
      onClose();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-muted';
  const labelClass = 'block text-xs text-muted mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${employee?.full_name}` : 'Add Employee'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Designation</label>
            <input
              className={inputClass}
              placeholder="e.g. Senior Developer"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Department</label>
          {addingDepartment ? (
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="New department name"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                autoFocus
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddDepartment} loading={submitting}>
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddingDepartment(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddingDepartment(true)}>
                + New
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Joining Date *</label>
            <input
              type="date"
              className={inputClass}
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Employment Type</label>
            <select
              className={inputClass}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as Employee['employment_type'])}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as Employee['status'])}
            >
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Base Salary</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                placeholder="0.00"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
              />
              <input
                className={`${inputClass} w-16 shrink-0 text-center`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
