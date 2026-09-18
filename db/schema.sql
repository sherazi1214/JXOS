-- ============================================================================
-- JASONEX OS — Internal Business Operating System / ERP
-- PostgreSQL schema (Supabase-ready)
-- ============================================================================
-- Design notes:
--   * UUID primary keys (gen_random_uuid()) — safe for distributed/public IDs
--   * Every table has created_at / updated_at; mutable business records also
--     carry created_by / updated_by (FK -> users) for accountability
--   * Soft delete (deleted_at) is used on records that must be recoverable /
--     kept for financial or audit reasons (employees, clients, contracts,
--     invoices, projects, leads). Lookup/junction tables hard-delete.
--   * All money columns are NUMERIC(14,2); currency is stored alongside
--     amounts wherever a record could be multi-currency.
--   * Enums are used for closed, spec-defined status lists. Anything the
--     business will want to edit without a migration (departments, expense
--     categories, lead sources) is a lookup table instead.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email matching

-- ============================================================================
-- 0. SHARED HELPERS
-- ============================================================================

-- Generic trigger to keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE employment_type_enum   AS ENUM ('full_time','part_time','contract','intern');
CREATE TYPE employee_status_enum   AS ENUM ('active','on_leave','suspended','terminated');

CREATE TYPE recruitment_stage_enum AS ENUM ('application','screening','interview','technical','final','offer','hired','rejected');

CREATE TYPE lead_stage_enum        AS ENUM ('new','contacted','qualified','discovery','proposal_sent','negotiation','won','lost');
CREATE TYPE lead_priority_enum     AS ENUM ('low','medium','high');
CREATE TYPE lead_activity_type_enum AS ENUM ('call','email','whatsapp','meeting','note','follow_up','proposal','status_change');

CREATE TYPE opportunity_status_enum AS ENUM ('open','won','lost');

CREATE TYPE client_status_enum     AS ENUM ('active','inactive','churned');
CREATE TYPE contract_status_enum   AS ENUM ('draft','active','expired','terminated');

CREATE TYPE project_status_enum    AS ENUM ('planning','in_progress','on_hold','completed','cancelled');
CREATE TYPE project_priority_enum  AS ENUM ('low','medium','high','urgent');
CREATE TYPE task_status_enum       AS ENUM ('not_started','in_progress','review','blocked','completed');

CREATE TYPE invoice_status_enum    AS ENUM ('draft','sent','partially_paid','paid','overdue','cancelled');
CREATE TYPE payment_method_enum    AS ENUM ('bank_transfer','credit_card','debit_card','cash','cheque','online_wallet','other');

CREATE TYPE expense_recurrence_enum AS ENUM ('one_time','recurring');

CREATE TYPE attendance_status_enum AS ENUM ('present','absent','late','half_day','leave','holiday');
CREATE TYPE leave_status_enum      AS ENUM ('pending','approved','rejected','cancelled');

CREATE TYPE payroll_status_enum    AS ENUM ('draft','approved','locked');

CREATE TYPE subscription_billing_cycle_enum AS ENUM ('monthly','quarterly','yearly','one_time');
CREATE TYPE asset_status_enum      AS ENUM ('available','assigned','in_repair','retired');
CREATE TYPE asset_condition_enum   AS ENUM ('new','good','fair','poor');

CREATE TYPE kpi_period_enum        AS ENUM ('monthly','quarterly','yearly');

CREATE TYPE notification_channel_enum AS ENUM ('email','whatsapp','in_app','push','sms');
CREATE TYPE notification_status_enum  AS ENUM ('pending','sent','failed','read');

CREATE TYPE file_owner_type_enum   AS ENUM ('candidate','employee','client','contract','project','invoice','expense','asset','lead');

-- ============================================================================
-- 2. IDENTITY / RBAC
-- ============================================================================

CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,          -- 'CEO/Admin','HR','Finance','Sales Manager','Salesperson','Project Manager','Employee'
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT false, -- prevents deletion of built-in roles
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,          -- e.g. 'invoices.create', 'payroll.approve'
  module        TEXT NOT NULL,                 -- e.g. 'finance', 'hr', 'crm'
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role_id         UUID NOT NULL REFERENCES roles(id),
  employee_id     UUID,                         -- FK added after employees table exists (nullable: not every user is staff)
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role_id) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================================================
-- 3. HR — DEPARTMENTS, EMPLOYEES, RECRUITMENT
-- ============================================================================

CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  manager_id    UUID,                          -- FK added below once employees exists
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code       TEXT NOT NULL UNIQUE,     -- human-readable ID, e.g. JT-0042
  full_name           TEXT NOT NULL,
  email               CITEXT NOT NULL UNIQUE,
  phone               TEXT,
  department_id       UUID REFERENCES departments(id),
  designation         TEXT,
  manager_id          UUID REFERENCES employees(id),
  joining_date        DATE NOT NULL,
  employment_type     employment_type_enum NOT NULL DEFAULT 'full_time',
  base_salary         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  bank_name            TEXT,
  bank_account_number  TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  status              employee_status_enum NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_employees_department ON employees(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_manager ON employees(manager_id) WHERE deleted_at IS NULL;

ALTER TABLE users   ADD CONSTRAINT fk_users_employee   FOREIGN KEY (employee_id)  REFERENCES employees(id);
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES employees(id);

CREATE TABLE candidates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL,
  email            CITEXT,
  phone            TEXT,
  position_title   TEXT NOT NULL,
  department_id    UUID REFERENCES departments(id),
  source           TEXT,                        -- LinkedIn, referral, job board, ...
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stage            recruitment_stage_enum NOT NULL DEFAULT 'application',
  interview_score  NUMERIC(4,1),
  expected_salary  NUMERIC(14,2),
  offered_salary   NUMERIC(14,2),
  joining_date     DATE,
  resume_file_id   UUID,                         -- FK added after files table exists
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidates_stage ON candidates(stage);

-- ============================================================================
-- 4. ATTENDANCE & LEAVE
-- ============================================================================

CREATE TABLE holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  holiday_date  DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (holiday_date, name)
);

CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in        TIMESTAMPTZ,
  check_out       TIMESTAMPTZ,
  working_hours   NUMERIC(5,2),
  late_minutes    INTEGER NOT NULL DEFAULT 0,
  overtime_hours  NUMERIC(5,2) NOT NULL DEFAULT 0,
  status          attendance_status_enum NOT NULL DEFAULT 'present',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);

CREATE TABLE leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type    TEXT NOT NULL,                  -- annual, sick, unpaid, casual, ...
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days_count    NUMERIC(4,1) NOT NULL,
  reason        TEXT,
  status        leave_status_enum NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_status ON leave_requests(status);

-- ============================================================================
-- 5. PAYROLL & COMPENSATION
-- ============================================================================

CREATE TABLE salary_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_date  DATE NOT NULL,
  base_salary     NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  reason          TEXT,                          -- raise, promotion, correction
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_records_employee ON salary_records(employee_id);

CREATE TABLE commissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL,                   -- 'opportunity','invoice', etc.
  source_id     UUID,                             -- polymorphic reference, no hard FK
  amount        NUMERIC(14,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  period_month  DATE NOT NULL,                    -- first-of-month marker for payroll period
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_employee_period ON commissions(employee_id, period_month);

CREATE TABLE bonuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  reason        TEXT,
  period_month  DATE NOT NULL,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bonuses_employee_period ON bonuses(employee_id, period_month);

CREATE TABLE payroll (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_month      DATE NOT NULL,                -- first-of-month
  base_salary       NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonus_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  overtime_pay      NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions        NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary        NUMERIC(14,2) GENERATED ALWAYS AS
                       (base_salary + commission_total + bonus_total + overtime_pay - deductions) STORED,
  status            payroll_status_enum NOT NULL DEFAULT 'draft',
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month)
);
CREATE INDEX idx_payroll_period ON payroll(period_month);

-- ============================================================================
-- 6. CRM — LEADS, ACTIVITIES, OPPORTUNITIES
-- ============================================================================

CREATE TABLE leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code           TEXT NOT NULL UNIQUE,
  company_name        TEXT NOT NULL,
  contact_person      TEXT,
  email               CITEXT,
  phone               TEXT,
  country             TEXT,
  city                TEXT,
  industry            TEXT,
  website             TEXT,
  source              TEXT NOT NULL,               -- website, Google, Facebook, referral, ...
  campaign            TEXT,
  service_interested  TEXT,
  lead_value          NUMERIC(14,2),
  currency            TEXT NOT NULL DEFAULT 'USD',
  stage               lead_stage_enum NOT NULL DEFAULT 'new',
  priority            lead_priority_enum NOT NULL DEFAULT 'medium',
  assigned_to         UUID REFERENCES employees(id),
  last_contact_at     TIMESTAMPTZ,
  next_follow_up_at   TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_leads_stage ON leads(stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_assigned ON leads(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_at) WHERE deleted_at IS NULL;

CREATE TABLE lead_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type lead_activity_type_enum NOT NULL,
  performed_by  UUID REFERENCES employees(id),
  summary       TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);

CREATE TABLE opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  value             NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  probability_pct   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (probability_pct BETWEEN 0 AND 100),
  expected_close_date DATE,
  status            opportunity_status_enum NOT NULL DEFAULT 'open',
  owner_id          UUID REFERENCES employees(id),
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);

-- ============================================================================
-- 7. CLIENTS, SERVICES, CONTRACTS
-- ============================================================================

CREATE TABLE clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code         TEXT NOT NULL UNIQUE,
  company_name        TEXT NOT NULL,
  country             TEXT,
  industry            TEXT,
  account_manager_id  UUID REFERENCES employees(id),
  source_lead_id      UUID REFERENCES leads(id),    -- traceability back to the originating lead
  status              client_status_enum NOT NULL DEFAULT 'active',
  client_since        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_clients_account_manager ON clients(account_manager_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_status ON clients(status) WHERE deleted_at IS NULL;

CREATE TABLE client_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  title         TEXT,
  email         CITEXT,
  phone         TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_contacts_client ON client_contacts(client_id);

CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,        -- Website Development, SEO, AI Automation, ...
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE client_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES services(id),
  started_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id, started_at)
);
CREATE INDEX idx_client_services_client ON client_services(client_id);

CREATE TABLE contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_code         TEXT NOT NULL UNIQUE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id            UUID REFERENCES services(id),
  start_date            DATE NOT NULL,
  end_date              DATE,
  contract_value        NUMERIC(14,2) NOT NULL,
  monthly_recurring_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'USD',
  payment_terms         TEXT,
  renewal_terms         TEXT,
  assigned_team_lead_id UUID REFERENCES employees(id),
  document_file_id      UUID,                       -- FK added after files table exists
  status                contract_status_enum NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_contracts_client ON contracts(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_end_date ON contracts(end_date) WHERE deleted_at IS NULL;

-- ============================================================================
-- 8. PROJECTS & OPERATIONS
-- ============================================================================

CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code      TEXT NOT NULL UNIQUE,
  client_id         UUID NOT NULL REFERENCES clients(id),
  service_id        UUID REFERENCES services(id),
  contract_id       UUID REFERENCES contracts(id),
  name              TEXT NOT NULL,
  project_manager_id UUID REFERENCES employees(id),
  start_date        DATE NOT NULL,
  deadline          DATE,
  budget            NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue           NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost              NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit            NUMERIC(14,2) GENERATED ALWAYS AS (revenue - cost) STORED,
  status            project_status_enum NOT NULL DEFAULT 'planning',
  priority          project_priority_enum NOT NULL DEFAULT 'medium',
  progress_pct      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_projects_client ON projects(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_manager ON projects(project_manager_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deadline ON projects(deadline) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_on_project TEXT,                        -- e.g. 'Developer','Designer','QA'
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, employee_id)
);

CREATE TABLE project_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_code         TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  assigned_to       UUID REFERENCES employees(id),
  priority          project_priority_enum NOT NULL DEFAULT 'medium',
  start_date        DATE,
  due_date          DATE,
  status            task_status_enum NOT NULL DEFAULT 'not_started',
  estimated_hours   NUMERIC(6,2),
  actual_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
  completion_pct    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON project_tasks(status);

CREATE TABLE task_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id),
  comment       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);

-- ============================================================================
-- 9. FINANCE — INVOICES, PAYMENTS, EXPENSES
-- ============================================================================

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  project_id      UUID REFERENCES projects(id),
  contract_id     UUID REFERENCES contracts(id),
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) GENERATED ALWAYS AS (subtotal + tax_amount - discount_amount) STORED,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          invoice_status_enum NOT NULL DEFAULT 'draft',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CHECK (due_date >= invoice_date)
);
CREATE INDEX idx_invoices_client ON invoices(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE deleted_at IS NULL;

CREATE TABLE invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(14,2) NOT NULL,
  line_total    NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  payment_method_enum NOT NULL,
  reference       TEXT,                         -- transaction/reference number
  notes           TEXT,
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_client ON payments(client_id);

-- Outstanding balance is derived, not stored, to avoid drift:
--   SELECT i.id, i.total_amount - COALESCE(SUM(p.amount),0) AS outstanding_balance
--   FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id GROUP BY i.id;

CREATE TABLE expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,           -- Office Rent, Salaries, Software, ...
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id     UUID NOT NULL REFERENCES expense_categories(id),
  vendor_id       UUID,                          -- FK added after vendors table exists
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  payment_method  payment_method_enum,
  department_id   UUID REFERENCES departments(id),
  project_id      UUID REFERENCES projects(id),
  description     TEXT,
  receipt_file_id UUID,                          -- FK added after files table exists
  recurrence      expense_recurrence_enum NOT NULL DEFAULT 'one_time',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_project ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- ============================================================================
-- 10. VENDORS & SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_email CITEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses ADD CONSTRAINT fk_expenses_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID NOT NULL REFERENCES vendors(id),
  service_name    TEXT NOT NULL,                 -- Hosting, SaaS tool, AI API, ...
  cost            NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  billing_cycle   subscription_billing_cycle_enum NOT NULL DEFAULT 'monthly',
  start_date      DATE NOT NULL,
  renewal_date    DATE,
  payment_method  payment_method_enum,
  owner_id        UUID REFERENCES employees(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_renewal ON subscriptions(renewal_date) WHERE is_active = true;

-- ============================================================================
-- 11. ASSETS & IT
-- ============================================================================

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code      TEXT NOT NULL UNIQUE,
  asset_type      TEXT NOT NULL,                 -- Laptop, Desktop, Mobile, Monitor, License, ...
  serial_number   TEXT,
  purchase_date   DATE,
  purchase_cost   NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  assigned_to     UUID REFERENCES employees(id),
  condition       asset_condition_enum NOT NULL DEFAULT 'new',
  warranty_until  DATE,
  location        TEXT,
  status          asset_status_enum NOT NULL DEFAULT 'available',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_assigned ON assets(assigned_to);

-- ============================================================================
-- 12. COMPANY GOALS & KPIs
-- ============================================================================

CREATE TABLE monthly_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month  DATE NOT NULL,                   -- first-of-month
  metric        TEXT NOT NULL,                   -- 'revenue','new_clients','leads','sales','profit', ...
  target_value  NUMERIC(14,2) NOT NULL,
  owner_id      UUID REFERENCES employees(id),   -- e.g. per-salesperson target
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_month, metric, owner_id)
);
CREATE INDEX idx_targets_period ON monthly_targets(period_month);

CREATE TABLE company_kpis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type     kpi_period_enum NOT NULL,
  period_start    DATE NOT NULL,
  metric          TEXT NOT NULL,
  target_value    NUMERIC(14,2) NOT NULL,
  actual_value    NUMERIC(14,2) NOT NULL DEFAULT 0,
  achievement_pct NUMERIC(6,2) GENERATED ALWAYS AS
                     (CASE WHEN target_value = 0 THEN 0 ELSE round((actual_value / target_value) * 100, 2) END) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_start, metric)
);

-- ============================================================================
-- 13. FILES, NOTIFICATIONS, AUDIT LOG
-- ============================================================================

CREATE TABLE files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type    file_owner_type_enum NOT NULL,
  owner_id      UUID NOT NULL,                    -- polymorphic; enforced in app layer
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,                     -- Supabase Storage path / bucket key
  mime_type     TEXT,
  size_bytes    BIGINT,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_owner ON files(owner_type, owner_id);

ALTER TABLE candidates ADD CONSTRAINT fk_candidates_resume FOREIGN KEY (resume_file_id) REFERENCES files(id);
ALTER TABLE contracts  ADD CONSTRAINT fk_contracts_document FOREIGN KEY (document_file_id) REFERENCES files(id);
ALTER TABLE expenses   ADD CONSTRAINT fk_expenses_receipt   FOREIGN KEY (receipt_file_id) REFERENCES files(id);

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel       notification_channel_enum NOT NULL DEFAULT 'in_app',
  title         TEXT NOT NULL,
  body          TEXT,
  link_url      TEXT,
  status        notification_status_enum NOT NULL DEFAULT 'pending',
  read_at       TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, status);

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  action        TEXT NOT NULL,                    -- 'create','update','delete','approve', ...
  entity_type   TEXT NOT NULL,                    -- table/entity name, e.g. 'invoice'
  entity_id     UUID,
  previous_value JSONB,
  new_value      JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================================================
-- 14. updated_at TRIGGERS (attach to every table that has the column)
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 15. SEED: built-in roles (permissions to be seeded by the app/migration tool)
-- ============================================================================

INSERT INTO roles (name, description, is_system) VALUES
  ('CEO/Admin',      'Full access to all modules and reports', true),
  ('HR',             'Employees, recruitment, attendance, leave, payroll inputs', true),
  ('Finance',        'Invoices, payments, expenses, payroll, financial reports', true),
  ('Sales Manager',  'Leads, opportunities, sales team, targets and performance', true),
  ('Salesperson',    'Own leads, follow-ups, opportunities and clients', true),
  ('Project Manager','Projects, tasks, team assignments and deadlines', true),
  ('Employee',       'Own attendance, leave, assigned tasks, profile', true);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
