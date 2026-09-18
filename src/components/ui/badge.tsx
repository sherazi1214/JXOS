import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'text-white bg-white/10 ring-1 ring-inset ring-white/10',
  primary: 'text-primary-light bg-primary/15 ring-1 ring-inset ring-primary/25',
  success: 'text-success bg-success/10 ring-1 ring-inset ring-success/25',
  warning: 'text-warning bg-warning/10 ring-1 ring-inset ring-warning/25',
  danger: 'text-danger bg-danger/10 ring-1 ring-inset ring-danger/25',
  muted: 'text-muted bg-white/5 ring-1 ring-inset ring-white/5',
};

export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
