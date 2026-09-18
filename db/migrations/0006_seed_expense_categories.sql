-- ============================================================================
-- 0006_seed_expense_categories.sql
--
-- Seeds `expense_categories` with the standard category list from the
-- business brief (Module 6 — Finance). The Expenses module lets Finance/CEO
-- add further categories at runtime (see POST /api/expense-categories), so
-- this is a starting set, not a hard-coded enum. Idempotent — safe to run
-- more than once.
-- ============================================================================

INSERT INTO expense_categories (name) VALUES
  ('Office Rent'),
  ('Electricity'),
  ('Internet'),
  ('Salaries'),
  ('Software'),
  ('Marketing'),
  ('Advertising'),
  ('Equipment'),
  ('Travel'),
  ('Vendor'),
  ('Operations'),
  ('Other')
ON CONFLICT (name) DO NOTHING;
