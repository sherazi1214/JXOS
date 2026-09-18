// ============================================================================
// Core TypeScript types mirroring db/schema.sql
// Keep these in sync with the Postgres schema — regenerate from the DB
// (e.g. via `supabase gen types typescript`) once the schema stabilizes.
// ============================================================================

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

export type LeadStage =
  | 'new' | 'contacted' | 'qualified' | 'discovery'
  | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high';
export type LeadActivityType =
  | 'call' | 'email' | 'whatsapp' | 'meeting'
  | 'note' | 'follow_up' | 'proposal' | 'status_change';

export type ClientStatus = 'active' | 'inactive' | 'churned';
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type TaskStatus = 'not_started' | 'in_progress' | 'review' | 'blocked' | 'completed';

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod =
  | 'bank_transfer' | 'credit_card' | 'debit_card'
  | 'cash' | 'cheque' | 'online_wallet' | 'other';

export type ExpenseRecurrence = 'one_time' | 'recurring';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PayrollStatus = 'draft' | 'approved' | 'locked';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_id: string;
  employee_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  designation: string | null;
  manager_id: string | null;
  joining_date: string;
  employment_type: EmploymentType;
  base_salary: number;
  currency: string;
  bank_name: string | null;
  bank_account_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Lead {
  id: string;
  lead_code: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  industry: string | null;
  website: string | null;
  source: string;
  campaign: string | null;
  service_interested: string | null;
  lead_value: number | null;
  currency: string;
  stage: LeadStage;
  priority: LeadPriority;
  assigned_to: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: LeadActivityType;
  performed_by: string | null;
  summary: string | null;
  occurred_at: string;
  created_at: string;
}

export type OpportunityStatus = 'open' | 'won' | 'lost';

export interface Opportunity {
  id: string;
  lead_id: string;
  name: string;
  value: number;
  currency: string;
  probability_pct: number;
  expected_close_date: string | null;
  status: OpportunityStatus;
  owner_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  client_code: string;
  company_name: string;
  country: string | null;
  industry: string | null;
  account_manager_id: string | null;
  source_lead_id: string | null;
  status: ClientStatus;
  client_since: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClientService {
  id: string;
  client_id: string;
  service_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  contract_code: string;
  client_id: string;
  service_id: string | null;
  start_date: string;
  end_date: string | null;
  contract_value: number;
  monthly_recurring_amt: number;
  currency: string;
  payment_terms: string | null;
  renewal_terms: string | null;
  assigned_team_lead_id: string | null;
  document_file_id: string | null;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectRecord {
  id: string;
  project_code: string;
  client_id: string;
  service_id: string | null;
  contract_id: string | null;
  name: string;
  project_manager_id: string | null;
  start_date: string;
  deadline: string | null;
  budget: number;
  revenue: number;
  cost: number;
  profit: number;
  status: ProjectStatus;
  priority: ProjectPriority;
  progress_pct: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  task_code: string;
  name: string;
  description: string | null;
  assigned_to: string | null;
  priority: ProjectPriority;
  start_date: string | null;
  status: TaskStatus;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  contract_id: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category_id: string;
  vendor_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod | null;
  department_id: string | null;
  project_id: string | null;
  description: string | null;
  receipt_file_id: string | null;
  recurrence: ExpenseRecurrence;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  working_hours: number | null;
  late_minutes: number;
  overtime_hours: number;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: LeaveStatus;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  period_month: string;
  base_salary: number;
  commission_total: number;
  bonus_total: number;
  overtime_pay: number;
  deductions: number;
  net_salary: number;
  status: PayrollStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RecruitmentStage =
  | 'application' | 'screening' | 'interview' | 'technical'
  | 'final' | 'offer' | 'hired' | 'rejected';

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position_title: string;
  department_id: string | null;
  source: string | null;
  application_date: string;
  stage: RecruitmentStage;
  interview_score: number | null;
  expected_salary: number | null;
  offered_salary: number | null;
  joining_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface Vendor {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  vendor_id: string;
  service_name: string;
  cost: number;
  currency: string;
  billing_cycle: SubscriptionBillingCycle;
  start_date: string;
  renewal_date: string | null;
  payment_method: PaymentMethod | null;
  owner_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AssetStatus = 'available' | 'assigned' | 'in_repair' | 'retired';
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor';

export interface Asset {
  id: string;
  asset_code: string;
  asset_type: string;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  currency: string;
  assigned_to: string | null;
  condition: AssetCondition;
  warranty_until: string | null;
  location: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
}

export type KpiPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface CompanyKpi {
  id: string;
  period_type: KpiPeriod;
  period_start: string;
  metric: string;
  target_value: number;
  actual_value: number;
  achievement_pct: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyTarget {
  id: string;
  period_month: string;
  metric: string;
  target_value: number;
  owner_id: string | null;
  created_at: string;
}

export type NotificationChannel = 'email' | 'whatsapp' | 'in_app' | 'push' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface AppNotification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  title: string;
  body: string | null;
  link_url: string | null;
  status: NotificationStatus;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  created_at: string;
}

export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProjectMember {
  project_id: string;
  employee_id: string;
  role_on_project: string | null;
  added_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  comment: string;
  created_at: string;
}
