import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  UserPlus, 
  XCircle, 
  Image as ImageIcon,
  X,
  ShieldAlert,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api, getWsUrl } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/events?limit=100');
      setEvents(res.data || []);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch threat events.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // WebSocket Connection
  useEffect(() => {
    const token = localStorage.getItem('token') || 'dummy-token';
    const wsUrl = getWsUrl(`/api/v1/ws?token=${token}`);
    
    let ws: WebSocket;
    
    const connect = () => {
      setWsStatus('connecting');
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => setWsStatus('connected');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.id) {
            setEvents(prev => {
              const exists = prev.find(e => e.id === data.id);
              if (exists) {
                return prev.map(e => e.id === data.id ? data : e);
              }
              return [data, ...prev];
            });
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };
      
      ws.onclose = (event) => {
        if (event.code === 1008 || event.code === 1003) {
          setWsStatus('error');
        } else {
          setWsStatus('disconnected');
          setTimeout(connect, 5000);
        }
      };
      
      ws.onerror = () => {
        setWsStatus('error');
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounted');
      }
    };
  }, []);

  const handleAction = async (eventId: string, action: 'acknowledge' | 'assign' | 'close') => {
    try {
      const res = await api.post(`/events/${eventId}/${action}`, { reason: 'Action triggered from SOC Dashboard' });
      setEvents(prev => prev.map(e => e.id === eventId ? res.data : e));
    } catch (err: any) {
      alert(`Failed to ${action} event: ` + (err.response?.data?.detail || err.message));
    }
  };

  const filteredEvents = events.filter(evt => {
    const matchesSearch = (evt.event_type || '').toLowerCase().includes(search.toLowerCase()) || 
                          (evt.camera_id || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || evt.state === statusFilter;
    const matchesSeverity = severityFilter === 'all' || evt.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-6.5rem)] animate-fade-in select-none">
      {/* Header */}
      <PageHeader
        title="Threat Events & Alerts"
        subtitle="Real-time automated incident detection, triage queues, and forensic evidence snapshots"
        icon={ShieldAlert}
        badge={
          <div className="flex items-center gap-2">
            {wsStatus === 'connected' && (
              <Badge variant="success" size="xs" dot pulse>
                WS LIVE STREAM
              </Badge>
            )}
            {wsStatus === 'connecting' && (
              <Badge variant="warning" size="xs" dot pulse>
                CONNECTING WS...
              </Badge>
            )}
            {(wsStatus === 'disconnected' || wsStatus === 'error') && (
              <Badge variant="outline" size="xs" dot>
                WS IDLE
              </Badge>
            )}
          </div>
        }
      >
        <button
          onClick={fetchEvents}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Event Feed"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="glass-card rounded-2xl border border-border/80 overflow-hidden flex flex-col flex-1 shadow-2xl">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-border/60 flex flex-col lg:flex-row gap-3 justify-between bg-surface/50">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search by event type or camera node..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-text-muted" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none appearance-none font-mono"
              >
                <option value="all">All States</option>
                <option value="OPEN">Open Incidents</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="CLOSED">Closed / Resolved</option>
              </select>
            </div>
            
            <div className="flex items-center bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5">
              <select 
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none appearance-none font-mono"
              >
                <option value="all">All Severities</option>
                <option value="low">Low Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="high">High Severity</option>
                <option value="critical">Critical Threats</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-5 py-3.5">Threat Classification</th>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Camera Source</th>
                <th className="px-5 py-3.5">Detected At</th>
                <th className="px-5 py-3.5">Confidence</th>
                <th className="px-5 py-3.5">Incident State</th>
                <th className="px-5 py-3.5 text-right">SOC Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <EmptyState
                      icon={ShieldAlert}
                      title="No threat incidents found"
                      description="No security alerts match the active filter criteria."
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const isCritical = event.severity === 'critical' || event.severity === 'high';
                  const isMed = event.severity === 'medium';
                  const isOpen = event.state === 'OPEN' || event.state === 'NEW';
                  const isClosed = event.state === 'CLOSED';

                  return (
                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 font-semibold text-text">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', isCritical ? 'bg-rose-500 animate-ping' : isMed ? 'bg-amber-400' : 'bg-blue-400')} />
                          <span className="capitalize">{event.event_type?.replace(/_/g, ' ') || 'Anomaly Detected'}</span>
                        </div>
                        {event.rule_id && (
                          <div className="text-[10px] font-mono text-text-dim mt-0.5 ml-4">
                            RULE: {event.rule_id.substring(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={isCritical ? 'danger' : isMed ? 'warning' : 'info'}
                          size="xs"
                        >
                          {event.severity?.toUpperCase() || 'INFO'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-mono text-cyan-400">
                        <div>{event.camera_id?.substring(0, 10) || 'NODE-01'}</div>
                        <div className="text-[10px] text-text-dim">{event.site_id ? `Site: ${event.site_id.substring(0, 8)}` : 'Main Sector'}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-text-muted">
                        {event.observed_at ? new Date(event.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold">
                        {event.confidence ? (
                          <span className="text-cyan-400">{(event.confidence * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-text-dim">95%</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={isOpen ? 'danger' : isClosed ? 'success' : 'warning'}
                          size="xs"
                          dot
                        >
                          {event.state?.toUpperCase() || 'OPEN'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Evidence button */}
                          <button 
                            onClick={() => setSelectedEvent(event)}
                            title="Inspect Evidence Snapshot" 
                            className="p-1.5 rounded-lg bg-surface/80 hover:bg-cyan-500/20 text-text-muted hover:text-cyan-300 border border-border/80 transition-colors"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>

                          {/* Action state triggers */}
                          {isOpen && (
                            <button 
                              onClick={() => handleAction(event.id, 'acknowledge')}
                              title="Acknowledge Threat" 
                              className="p-1.5 rounded-lg bg-surface/80 hover:bg-amber-500/20 text-text-muted hover:text-amber-400 border border-border/80 transition-colors"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(isOpen || event.state === 'ACKNOWLEDGED') && (
                            <button 
                              onClick={() => handleAction(event.id, 'assign')}
                              title="Claim Incident" 
                              className="p-1.5 rounded-lg bg-surface/80 hover:bg-blue-500/20 text-text-muted hover:text-blue-400 border border-border/80 transition-colors"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isClosed && (
                            <button 
                              onClick={() => handleAction(event.id, 'close')}
                              title="Resolve & Close" 
                              className="p-1.5 rounded-lg bg-surface/80 hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 border border-border/80 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Bar */}
        <div className="p-3.5 border-t border-border/60 flex justify-between items-center bg-[#050811]/60 text-xs text-text-muted font-mono">
          <span>LOGGED INCIDENTS: {filteredEvents.length}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              EDGE CV ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Forensic Evidence Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-full">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 bg-surface/60">
              <div>
                <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <span>{selectedEvent.event_type?.replace(/_/g, ' ')} Forensic Snapshot</span>
                </h3>
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  Observed: {selectedEvent.observed_at ? new Date(selectedEvent.observed_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-text uppercase tracking-wider font-mono mb-2">
                    Visual Snapshot
                  </h4>
                  <div className="aspect-video bg-black rounded-xl border border-border/80 flex items-center justify-center overflow-hidden relative">
                    <div className="pointer-events-none absolute inset-0 bg-cyber-grid opacity-20" />
                    {selectedEvent.snapshot_url ? (
                      <img src={selectedEvent.snapshot_url} alt="Event Evidence" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-text-dim text-xs font-mono">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
                        <span>NO SNAPSHOT PAYLOAD RECORDED</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold text-text uppercase tracking-wider font-mono mb-2">
                    Video Stream Segment
                  </h4>
                  <div className="aspect-video bg-black rounded-xl border border-border/80 flex items-center justify-center overflow-hidden relative">
                    <div className="pointer-events-none absolute inset-0 bg-cyber-grid opacity-20" />
                    {selectedEvent.video_url ? (
                      <video src={selectedEvent.video_url} controls className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-text-dim text-xs font-mono">
                        <XCircle className="w-8 h-8 mb-2 opacity-40 text-rose-400" />
                        <span>NO CLIP ARCHIVE ATTACHED</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider font-mono mb-2">
                  Telemetry Payload Schema
                </h4>
                <div className="bg-[#050811] border border-border/80 rounded-xl p-4 font-mono text-[11px] overflow-x-auto text-cyan-300">
                  <pre>{JSON.stringify(selectedEvent.metadata || { "node_id": selectedEvent.camera_id, "confidence": selectedEvent.confidence || 0.94, "status": "processed" }, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
