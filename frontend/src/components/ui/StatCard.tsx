import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export type StatAccent = 'blue' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  accent?: StatAccent;
  className?: string;
  onClick?: () => void;
}

const ACCENT_MAP: Record<StatAccent, {
  border: string;
  iconBg: string;
  iconColor: string;
  glow: string;
  topLine: string;
}> = {
  blue: {
    border: 'hover:border-blue-500/40',
    iconBg: 'bg-blue-500/15 border border-blue-500/30',
    iconColor: 'text-blue-400',
    glow: 'from-blue-500/10 via-transparent to-transparent',
    topLine: 'from-blue-500 to-indigo-500',
  },
  cyan: {
    border: 'hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/15 border border-cyan-500/30',
    iconColor: 'text-cyan-400',
    glow: 'from-cyan-500/10 via-transparent to-transparent',
    topLine: 'from-cyan-400 to-blue-500',
  },
  violet: {
    border: 'hover:border-purple-500/40',
    iconBg: 'bg-purple-500/15 border border-purple-500/30',
    iconColor: 'text-purple-400',
    glow: 'from-purple-500/10 via-transparent to-transparent',
    topLine: 'from-purple-500 to-pink-500',
  },
  emerald: {
    border: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/15 border border-emerald-500/30',
    iconColor: 'text-emerald-400',
    glow: 'from-emerald-500/10 via-transparent to-transparent',
    topLine: 'from-emerald-400 to-teal-500',
  },
  amber: {
    border: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/15 border border-amber-500/30',
    iconColor: 'text-amber-400',
    glow: 'from-amber-500/10 via-transparent to-transparent',
    topLine: 'from-amber-400 to-orange-500',
  },
  rose: {
    border: 'hover:border-rose-500/40',
    iconBg: 'bg-rose-500/15 border border-rose-500/30',
    iconColor: 'text-rose-400',
    glow: 'from-rose-500/10 via-transparent to-transparent',
    topLine: 'from-rose-500 to-red-600',
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  accent = 'blue',
  className,
  onClick,
}: StatCardProps) {
  const styles = ACCENT_MAP[accent] || ACCENT_MAP.blue;

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card relative overflow-hidden rounded-2xl p-5 transition-all duration-300',
        styles.border,
        onClick ? 'cursor-pointer hover:-translate-y-1' : '',
        className
      )}
    >
      {/* Top subtle illuminated gradient line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-70',
          styles.topLine
        )}
      />

      {/* Ambient corner glow */}
      <div
        className={cn(
          'pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-50 blur-2xl',
          styles.glow
        )}
      />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-text">
              {value}
            </span>
          </div>
        </div>

        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl backdrop-blur-md', styles.iconBg)}>
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border/40">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold',
                  trend.isPositive !== false
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                )}
              >
                {trend.isPositive !== false ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </span>
              {trend.label && <span className="text-text-muted/70">{trend.label}</span>}
            </div>
          ) : (
            <span className="text-text-muted/70">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
