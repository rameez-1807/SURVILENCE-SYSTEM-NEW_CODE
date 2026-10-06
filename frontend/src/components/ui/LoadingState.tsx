import { Loader2, Radio } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  className?: string;
  compact?: boolean;
}

export function LoadingState({
  message = 'Initializing neural telemetry...',
  submessage = 'Connecting to real-time inference nodes',
  className,
  compact = false,
}: LoadingStateProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center justify-center gap-2 py-4 text-text-muted text-xs', className)}>
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className={cn('glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center', className)}>
      <div className="relative mb-6">
        {/* Outer glowing pulsing ring */}
        <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
        
        {/* Rotating radar ring */}
        <div className="relative w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary flex items-center justify-center animate-spin">
          <div className="w-10 h-10 rounded-full border border-cyan-400/40 border-b-cyan-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="w-5 h-5 text-primary animate-pulse" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-text tracking-wide">{message}</h3>
      {submessage && (
        <p className="text-xs text-text-muted mt-1 max-w-sm font-mono">{submessage}</p>
      )}
    </div>
  );
}
