import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center border-dashed border-border/70',
        className
      )}
    >
      <div className="relative mb-4">
        <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-lg" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-border/80 text-text-muted">
          <Icon className="h-7 w-7 text-primary/80" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-md">{description}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-md shadow-primary/25 hover:bg-primary-hover transition-all duration-200 active:scale-95"
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
