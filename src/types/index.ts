// ============================================================================
// Barrel export — re-exports the DB-mirroring types plus a couple of small
// shared shapes used across API routes/components (pagination envelope,
// generic option lists). Prefer importing directly from '@/types/database'
// for entity types; this file is for the odds and ends that don't belong
// to any one domain.
// ============================================================================

export * from '@/types/database';

/** Standard shape returned by every paginated list endpoint (/api/leads, /api/invoices, ...). */
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  [key: string]: T[] | number | string | undefined;
}

/** Generic { value, label } option used to populate <select> dropdowns. */
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

/** Shape returned by GET /api/auth/me — the current user plus resolved permission codes. */
export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
    role_id: string;
    employee_id: string | null;
  };
  permissions: string[];
}
