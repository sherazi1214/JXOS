-- ============================================================================
-- 0003_seed_clients_permissions.sql
--
-- Seeds the `permissions` rows used by the Clients module (see
-- src/lib/rbac.ts -> CLIENT_PERMISSIONS) and wires them up to the built-in
-- roles. Idempotent — safe to run more than once.
--
--   clients.view      — see clients you're the account manager for
--   clients.view_all  — see every client in the company
--   clients.create    — create a client manually, or convert a won lead
--   clients.update    — edit client fields, manage contacts/services
--   clients.delete    — soft-delete a client
--   clients.assign    — reassign a client's account manager; also gates
--                        converting a Lead into a Client
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('clients.view',      'clients', 'View clients you are the account manager for'),
  ('clients.view_all',  'clients', 'View every client in the company'),
  ('clients.create',    'clients', 'Create a client manually, or convert a won lead'),
  ('clients.update',    'clients', 'Edit client fields and manage contacts/services'),
  ('clients.delete',    'clients', 'Soft-delete a client'),
  ('clients.assign',    'clients', 'Reassign a client''s account manager')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Sales Manager: full access, including cross-team visibility
-- and account-manager reassignment.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Sales Manager')
  AND p.code IN ('clients.view', 'clients.view_all', 'clients.create', 'clients.update', 'clients.delete', 'clients.assign')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Salesperson: own clients (as account manager) only — view/create (via
-- lead conversion)/update, no delete, no cross-team visibility.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Salesperson'
  AND p.code IN ('clients.view', 'clients.create', 'clients.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Project Manager: needs to see every client to staff and scope projects,
-- but never edits client/account-manager data.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Project Manager'
  AND p.code IN ('clients.view', 'clients.view_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;
