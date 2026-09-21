import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
  ShieldAlert
} from 'lucide-react';
import { api } from '../lib/api';
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
      
      setSaveStatus('✓ Label corrected successfully');
      setTimeout(() => setSaveStatus(null), 3500);
      
      // Remove from list
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to correct label:', err);
      setSaveStatus('Failed to save correction.');
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fade-in relative">
      {saveStatus && (
        <div className="fixed top-8 right-8 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-sm px-4 py-2 rounded-full flex items-center gap-2 z-50 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          {saveStatus.includes('Failed') ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4" />}
          <span className={saveStatus.includes('Failed') ? 'text-red-400' : ''}>{saveStatus}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-cyan-400" />
            Review Queue
          </h1>
          <p className="text-slate-400 mt-2">
            Manually review and correct low-confidence or flagged AI detections.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center flex flex-col items-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500/50 mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Queue is Empty</h3>
          <p className="text-slate-400">No items need review right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <div key={event.id} className="bg-slate-800/80 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600/50 transition-colors flex flex-col">
              {event.evidence_reference && event.evidence_reference.startsWith('data:image') ? (
                <div className="h-48 w-full bg-black relative border-b border-slate-700/50">
                  <img 
                    src={event.evidence_reference} 
                    alt="Evidence" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-48 w-full bg-slate-900/50 flex flex-col items-center justify-center border-b border-slate-700/50 text-slate-500">
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs">{event.evidence_reference || 'No image available'}</span>
                </div>
              )}
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.observed_at).toLocaleString()}
                    </div>
                    {event.camera_id && (
                      <div className="text-slate-500 text-xs flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        Camera {event.camera_id.substring(0, 8)}
                      </div>
                    )}
                  </div>
                  
                  {event.is_llm_verified ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI-Verified
                    </div>
                  ) : (
                    <div className={cn(
                      "px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider",
                      event.confidence > 0.7 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                      event.confidence > 0.4 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                      "bg-red-500/10 border-red-500/30 text-red-400"
                    )}>
                      {Math.round(event.confidence * 100)}% Match
                    </div>
                  )}
                </div>
                
                <div className="mt-auto space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Correct Label
                    </label>
                    <input 
                      type="text" 
                      value={inputs[event.id] || ''}
                      onChange={(e) => setInputs(prev => ({ ...prev, [event.id]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder="Enter correct object name"
                    />
                  </div>
                  
                  <button
                    onClick={() => handleCorrect(event.id)}
                    className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm / Correct
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
