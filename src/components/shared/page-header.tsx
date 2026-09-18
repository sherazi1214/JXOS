// ============================================================================
// PageHeader — consistent header used at the top of each module page:
// title, optional subtitle/description, and an optional action slot on the
// right (buttons, filters, etc). Purely presentational — no data fetching.
// ============================================================================

import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1 animate-fade-in-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
