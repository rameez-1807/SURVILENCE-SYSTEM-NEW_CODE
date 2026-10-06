import React from 'react';
import { Video, Maximize2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Badge } from './Badge';
import { cn } from '../../utils/cn';

interface CameraCardProps {
  id: string | number;
  name: string;
  location?: string;
  status: 'ONLINE' | 'OFFLINE' | 'RECORDING' | 'ALERT' | string;
  streamUrl?: string;
  fps?: number;
  resolution?: string;
  activeDetections?: number;
  onView?: (id: string | number) => void;
  className?: string;
  children?: React.ReactNode;
}

export function CameraCard({
  id,
  name,
  location = 'Primary Zone',
  status,
  streamUrl,
  fps = 30,
  resolution = '1080p',
  activeDetections = 0,
  onView,
  className,
  children,
}: CameraCardProps) {
  const isOnline = status.toUpperCase() === 'ONLINE' || status.toUpperCase() === 'RECORDING';
  const isAlert = status.toUpperCase() === 'ALERT';

  return (
    <div
      className={cn(
        'group glass-card glass-card-hover rounded-2xl overflow-hidden border border-border/80 flex flex-col',
        isAlert ? 'border-rose-500/50 shadow-rose-500/10' : '',
        className
      )}
    >
      {/* Feed Container */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Cyber grid lines */}
        <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />

        {/* Video feed or placeholder */}
        {children ? (
          children
        ) : streamUrl ? (
          <img
            src={streamUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-text-dim text-xs gap-2">
            <Video className="w-8 h-8 opacity-40" />
            <span className="font-mono">NO SIGNAL FEED</span>
          </div>
        )}

        {/* Corner Cyber Brackets */}
        <div className="pointer-events-none absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60" />
        <div className="pointer-events-none absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60" />
        <div className="pointer-events-none absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60" />
        <div className="pointer-events-none absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60" />

        {/* Top Overlay: Camera Name & Status */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-[11px] font-mono font-medium text-white">
            <span className="truncate max-w-[130px]">{name}</span>
          </div>

          <Badge
            variant={isAlert ? 'danger' : isOnline ? 'success' : 'outline'}
            size="xs"
            dot
            pulse={isOnline || isAlert}
          >
            {status}
          </Badge>
        </div>

        {/* Bottom Overlay: Telemetry & Controls */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-white/80 z-10 pointer-events-auto">
          <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
            <span>{resolution}</span>
            <span>•</span>
            <span>{fps} FPS</span>
            {activeDetections > 0 && (
              <>
                <span>•</span>
                <span className="text-cyan-400 font-bold">{activeDetections} DET</span>
              </>
            )}
          </div>

          {onView && (
            <button
              onClick={() => onView(id)}
              className="p-1 rounded bg-black/65 hover:bg-primary backdrop-blur-md border border-white/10 text-white transition-colors duration-150"
              title="Expand Feed"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 flex items-center justify-between bg-surface/40 border-t border-border/50">
        <div>
          <h4 className="text-xs font-semibold text-text truncate max-w-[160px]">{name}</h4>
          <p className="text-[11px] text-text-muted truncate">{location}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          {isOnline ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>
    </div>
  );
}
