-- ============================================================================
-- 0005_seed_hr_permissions.sql
--
-- Seeds `permissions` rows for Attendance and Leave Requests (see
-- src/lib/rbac.ts -> ATTENDANCE_PERMISSIONS / LEAVE_PERMISSIONS) and wires
-- them up to the built-in roles. Idempotent — safe to run more than once.
--
--   attendance.view      — see your own attendance record
--   attendance.view_all  — see every employee's attendance
--   attendance.check_in  — check yourself in / out
--   attendance.update    — manually correct an attendance record
--
--   leave.view           — see your own leave requests
--   leave.view_all       — see every employee's leave requests
--   leave.create         — submit a leave request
--   leave.approve        — approve or reject a leave request
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('attendance.view',      'hr', 'View your own attendance record'),
  ('attendance.view_all',  'hr', 'View every employee''s attendance'),
  ('attendance.check_in',  'hr', 'Check yourself in and out'),
  ('attendance.update',    'hr', 'Manually correct an attendance record'),

  ('leave.view',            'hr', 'View your own leave requests'),
  ('leave.view_all',        'hr', 'View every employee''s leave requests'),
  ('leave.create',          'hr', 'Submit a leave request'),
  ('leave.approve',         'hr', 'Approve or reject a leave request')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and HR: full access — company-wide visibility, manual
-- corrections, and approval rights.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'HR')
  AND p.code IN (
    'attendance.view', 'attendance.view_all', 'attendance.check_in', 'attendance.update',
    'leave.view', 'leave.view_all', 'leave.create', 'leave.approve'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Project Manager: needs team visibility to plan around absences, but no
-- editing or approval rights (that stays with HR).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Project Manager'
  AND p.code IN ('attendance.view_all', 'leave.view_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Everyone else (Finance, Sales Manager, Salesperson, Employee): only their
-- own record — check in/out, view own attendance, submit own leave.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Finance', 'Sales Manager', 'Salesperson', 'Employee')
  AND p.code IN ('attendance.view', 'attendance.check_in', 'leave.view', 'leave.create')
ON CONFLICT (role_id, permission_id) DO NOTHING;