import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<StatTone, string> = {
  primary: 'text-primary-light bg-primary/15 ring-1 ring-inset ring-primary/25',
  accent: 'text-accent bg-accent/15 ring-1 ring-inset ring-accent/25',
  success: 'text-success bg-success/15 ring-1 ring-inset ring-success/25',
  warning: 'text-warning bg-warning/15 ring-1 ring-inset ring-warning/25',
  danger: 'text-danger bg-danger/15 ring-1 ring-inset ring-danger/25',
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={cn('card card-hover animate-fade-in flex items-start justify-between gap-3 group', className)}>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="stat-value mt-1.5 truncate">{value}</p>
        {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn('icon-tile transition-transform duration-200 group-hover:scale-110', TONE_CLASSES[tone])}>
          <Icon size={18} />
        </span>
      )}
    </div>
  );
}
