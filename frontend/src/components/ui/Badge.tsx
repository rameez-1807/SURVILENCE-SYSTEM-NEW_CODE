import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'cyan' | 'violet' | 'outline';
export type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  className,
  icon
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
    default: {
      badge: 'bg-surface-hover text-text-muted border-border',
      dot: 'bg-text-muted',
    },
    success: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-400',
    },
    danger: {
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
      dot: 'bg-rose-400',
    },
    warning: {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      dot: 'bg-amber-400',
    },
    info: {
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      dot: 'bg-blue-400',
    },
    cyan: {
      badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
      dot: 'bg-cyan-400',
    },
    violet: {
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
      dot: 'bg-purple-400',
    },
    outline: {
      badge: 'bg-transparent text-text-muted border-border hover:border-slate-600',
      dot: 'bg-text-muted',
    },
  };

  const sizeStyles: Record<BadgeSize, string> = {
    xs: 'text-[10px] px-1.5 py-0.5 font-medium tracking-wide',
    sm: 'text-xs px-2.5 py-0.5 font-medium',
    md: 'text-sm px-3 py-1 font-semibold',
  };

  const selected = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 select-none backdrop-blur-sm',
        selected.badge,
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                selected.dot
              )}
            />
          )}
          <span className={cn('relative inline-flex rounded-full h-2 w-2', selected.dot)} />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
