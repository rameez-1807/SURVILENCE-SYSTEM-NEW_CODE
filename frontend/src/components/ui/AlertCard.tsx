import { AlertTriangle, ShieldAlert, Info, Clock, ChevronRight } from 'lucide-react';
import { Badge } from './Badge';
import { cn } from '../../utils/cn';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface AlertCardProps {
  id: string | number;
  title: string;
  description?: string;
  severity?: AlertSeverity;
  cameraName?: string;
  timestamp?: string;
  thumbnailUrl?: string;
  onClick?: (id: string | number) => void;
  className?: string;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  border: string;
  bg: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  badgeVariant: 'danger' | 'warning' | 'info' | 'default';
}> = {
  critical: {
    border: 'border-rose-500/30 hover:border-rose-500/60',
    bg: 'bg-rose-500/5',
    icon: ShieldAlert,
    iconColor: 'text-rose-400',
    badgeVariant: 'danger',
  },
  high: {
    border: 'border-rose-500/30 hover:border-rose-500/60',
    bg: 'bg-rose-500/5',
    icon: ShieldAlert,
    iconColor: 'text-rose-400',
    badgeVariant: 'danger',
  },
  medium: {
    border: 'border-amber-500/30 hover:border-amber-500/60',
    bg: 'bg-amber-500/5',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    badgeVariant: 'warning',
  },
  low: {
    border: 'border-blue-500/30 hover:border-blue-500/60',
    bg: 'bg-blue-500/5',
    icon: Info,
    iconColor: 'text-blue-400',
    badgeVariant: 'info',
  },
  info: {
    border: 'border-blue-500/30 hover:border-blue-500/60',
    bg: 'bg-blue-500/5',
    icon: Info,
    iconColor: 'text-blue-400',
    badgeVariant: 'info',
  },
};

export function AlertCard({
  id,
  title,
  description,
  severity = 'medium',
  cameraName,
  timestamp = 'Just now',
  thumbnailUrl,
  onClick,
  className,
}: AlertCardProps) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  const Icon = config.icon;

  return (
    <div
      onClick={() => onClick && onClick(id)}
      className={cn(
        'group glass-card rounded-xl p-3.5 border transition-all duration-200 flex items-start gap-3.5',
        config.border,
        config.bg,
        onClick ? 'cursor-pointer hover:translate-x-1' : '',
        className
      )}
    >
      <div className={cn('p-2 rounded-lg bg-surface border border-border/80 shrink-0 mt-0.5', config.iconColor)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="text-xs font-semibold text-text truncate group-hover:text-primary transition-colors">
            {title}
          </h4>
          <Badge variant={config.badgeVariant} size="xs">
            {severity.toUpperCase()}
          </Badge>
        </div>

        {description && (
          <p className="text-[11px] text-text-muted line-clamp-1 mb-2">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between text-[10px] text-text-dim">
          <div className="flex items-center gap-2">
            {cameraName && (
              <span className="font-medium text-text-muted">{cameraName}</span>
            )}
            {cameraName && <span>•</span>}
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {timestamp}
            </span>
          </div>

          {onClick && (
            <ChevronRight className="w-3.5 h-3.5 text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </div>

      {thumbnailUrl && (
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-slate-900">
          <img src={thumbnailUrl} alt="Event thumbnail" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
