-- ============================================================================
-- 0004_seed_finance_permissions.sql
--
-- Seeds the `permissions` rows used by the Contracts, Invoices, Payments and
-- Expenses modules (see src/lib/rbac.ts -> CONTRACT_PERMISSIONS,
-- INVOICE_PERMISSIONS, PAYMENT_PERMISSIONS, EXPENSE_PERMISSIONS) and wires
-- them up to the built-in roles. Idempotent — safe to run more than once.
--
--   contracts.view      — see contracts for clients you manage
--   contracts.view_all  — see every contract in the company
--   contracts.create    — create a contract (manually, or via lead conversion)
--   contracts.update    — edit contract fields / change status
--   contracts.delete    — soft-delete a contract
--
--   invoices.view       — see invoices (Finance-owned data, no partial scoping)
--   invoices.view_all   — required to browse the module at all (see rbac.ts)
--   invoices.create     — create an invoice
--   invoices.update     — edit an invoice, mark sent/cancelled
--   invoices.delete     — soft-delete an invoice
--
--   payments.view       — see payments recorded against invoices
--   payments.create     — record a payment
--   payments.delete     — void/delete a recorded payment
--
--   expenses.view       — see company expenses
--   expenses.create     — log an expense
--   expenses.update     — edit an expense
--   expenses.delete     — delete an expense
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('contracts.view',      'contracts', 'View contracts for clients you manage'),
  ('contracts.view_all',  'contracts', 'View every contract in the company'),
  ('contracts.create',    'contracts', 'Create a contract'),
  ('contracts.update',    'contracts', 'Edit contract fields and status'),
  ('contracts.delete',    'contracts', 'Soft-delete a contract'),

  ('invoices.view',       'invoices', 'View invoices'),
  ('invoices.view_all',   'invoices', 'View every invoice in the company'),
  ('invoices.create',     'invoices', 'Create an invoice'),
  ('invoices.update',     'invoices', 'Edit an invoice / change its status'),
  ('invoices.delete',     'invoices', 'Soft-delete an invoice'),

  ('payments.view',       'payments', 'View payments recorded against invoices'),
  ('payments.create',     'payments', 'Record a payment against an invoice'),
  ('payments.delete',     'payments', 'Void/delete a recorded payment'),

  ('expenses.view',       'expenses', 'View company expenses'),
  ('expenses.create',     'expenses', 'Log a company expense'),
  ('expenses.update',     'expenses', 'Edit a company expense'),
  ('expenses.delete',     'expenses', 'Delete a company expense')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Finance: full access across all four modules.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Finance')
  AND p.code IN (
    'contracts.view', 'contracts.view_all', 'contracts.create', 'contracts.update', 'contracts.delete',
    'invoices.view', 'invoices.view_all', 'invoices.create', 'invoices.update', 'invoices.delete',
    'payments.view', 'payments.create', 'payments.delete',
    'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Manager: full visibility + edit rights on contracts (their team
-- closes and manages these), but no invoicing/payments/expenses access —
-- that stays with Finance.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales Manager'
  AND p.code IN ('contracts.view', 'contracts.view_all', 'contracts.create', 'contracts.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Salesperson: contracts for clients they manage — view/create/update,
-- no delete, no cross-team visibility.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Salesperson'
  AND p.code IN ('contracts.view', 'contracts.create', 'contracts.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Project Manager: read-only visibility into every contract, to scope and
-- staff projects correctly — never edits contract/financial data.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Project Manager'
  AND p.code IN ('contracts.view', 'contracts.view_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;
