import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
  ShieldAlert,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

interface ObjectDetectionEvent {
  id: string;
  event_type: string;
  confidence: number;
  camera_id?: string;
  observed_at: string;
  evidence_reference?: string;
  is_llm_verified?: boolean;
}

export default function ReviewQueue() {
  const [events, setEvents] = useState<ObjectDetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  // Track inputs for each row
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/events/review-queue?limit=100');
      const data: ObjectDetectionEvent[] = res.data || [];
      setEvents(data);
      
      // Pre-fill inputs
      const initialInputs: { [key: string]: string } = {};
      data.forEach(e => {
        const label = e.event_type.replace('_detected', '').replace(/_/g, ' ');
        initialInputs[e.id] = label.charAt(0).toUpperCase() + label.slice(1);
      });
      setInputs(initialInputs);
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
      setError('Could not fetch review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleCorrect = async (id: string) => {
    const newLabel = inputs[id];
    if (!newLabel || !newLabel.trim()) return;

    try {
      setSaveStatus('Saving correction...');
      await api.patch(`/events/${id}/correct-label`, {
        corrected_label: newLabel.trim()
      });
      
      setSaveStatus('✓ Label corrected and verified successfully');
      setTimeout(() => setSaveStatus(null), 3500);
      
      // Remove from list
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to correct label:', err);
      setSaveStatus('Failed to save correction.');
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-80 bg-surface/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Toast Notification */}
      {saveStatus && (
        <div className="fixed top-20 right-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 z-50 animate-slide-up shadow-2xl backdrop-blur-md">
          {saveStatus.includes('Failed') ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Human-in-the-Loop Review Queue"
        subtitle="Manually inspect, label, and retrain low-confidence computer vision detections"
        icon={ShieldAlert}
        badge={
          <Badge variant={events.length > 0 ? "warning" : "success"} size="xs" dot pulse={events.length > 0}>
            {events.length} PENDING TRIAGE
          </Badge>
        }
      >
        <button
          onClick={fetchQueue}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Queue"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Review Queue is Empty"
          description="All low-confidence detections have been audited and verified. The neural feedback pipeline is clear."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="glass-card glass-card-hover rounded-2xl overflow-hidden border border-border/80 flex flex-col shadow-xl"
            >
              {/* Evidence Media Snapshot */}
              <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden border-b border-border/60">
                <div className="pointer-events-none absolute inset-0 bg-cyber-grid opacity-25" />

                {/* Corner reticles */}
                <div className="pointer-events-none absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60" />
                <div className="pointer-events-none absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60" />
                <div className="pointer-events-none absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60" />
                <div className="pointer-events-none absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60" />

                {event.evidence_reference && event.evidence_reference.startsWith('data:image') ? (
                  <img 
                    src={event.evidence_reference} 
                    alt="Evidence Frame" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-text-dim text-xs font-mono p-4 text-center">
                    <Camera className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
                    <span className="truncate max-w-[200px]">{event.evidence_reference || 'Telemetry Snapshot'}</span>
                  </div>
                )}

                {/* Top Badge: AI-Confidence */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  {event.is_llm_verified ? (
                    <Badge variant="cyan" size="xs" icon={<Sparkles className="w-3 h-3" />}>
                      LLM VERIFIED
                    </Badge>
                  ) : (
                    <Badge
                      variant={event.confidence > 0.7 ? "success" : event.confidence > 0.4 ? "warning" : "danger"}
                      size="xs"
                    >
                      {Math.round(event.confidence * 100)}% CONFIDENCE
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between text-xs text-text-muted">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(event.observed_at).toLocaleString()}</span>
                    </div>
                    {event.camera_id && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-400">
                        <Camera className="w-3.5 h-3.5" />
                        <span>CAMERA: {event.camera_id.substring(0, 10)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Correction Input */}
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-text uppercase tracking-wider mb-1.5">
                      Target Classification Label
                    </label>
                    <div className="relative">
                      <Edit3 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input 
                        type="text" 
                        value={inputs[event.id] || ''}
                        onChange={(e) => setInputs(prev => ({ ...prev, [event.id]: e.target.value }))}
                        className="w-full bg-[#0a0f1d] border border-border/80 text-white rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                        placeholder="e.g. Authorized Vehicle"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleCorrect(event.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold py-2.5 rounded-xl text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Feed AI Pipeline</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
