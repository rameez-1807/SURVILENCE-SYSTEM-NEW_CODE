import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  UserPlus, 
  XCircle, 
  Image as ImageIcon,
  Wifi,
  WifiOff,
  Activity,
  X
} from 'lucide-react';
import { api } from '../lib/api';
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
        setError('Failed to fetch events.');
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
    const wsUrl = `ws://localhost:8000/api/v1/ws?token=${token}`; // Adjust path if WS is at root
    // But based on backend, router prefix is /ws. So /api/v1/ws
    
    let ws: WebSocket;
    
    const connect = () => {
      setWsStatus('connecting');
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => setWsStatus('connected');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Assuming data represents an event or alert
          if (data && data.id) {
            setEvents(prev => {
              // Prevent duplication
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
          setWsStatus('error'); // Auth or tenant error
        } else {
          setWsStatus('disconnected');
          // Optional: implement reconnect logic
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
      const res = await api.post(`/events/${eventId}/${action}`, { reason: 'Action triggered from dashboard' });
      // Update local state
      setEvents(prev => prev.map(e => e.id === eventId ? res.data : e));
    } catch (err: any) {
      alert(`Failed to ${action} event: ` + (err.response?.data?.detail || err.message));
    }
  };

  const filteredEvents = events.filter(evt => {
    const matchesSearch = evt.event_type.toLowerCase().includes(search.toLowerCase()) || 
                          evt.camera_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || evt.state === statusFilter;
    const matchesSeverity = severityFilter === 'all' || evt.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  if (loading && events.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-surface border border-border rounded-lg overflow-hidden h-[600px] flex flex-col">
          <div className="h-16 border-b border-border bg-surface-hover/30"></div>
          <div className="flex-1 p-4 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-full h-12 bg-surface-hover rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="bg-surface border border-danger/50 rounded-lg p-8 max-w-md text-center">
          <Activity className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">Access Error</h2>
          <p className="text-text-muted">{error}</p>
          <button 
            onClick={fetchEvents}
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-3">
            Events & Alerts
            {wsStatus === 'connected' && <span title="Live Stream Active" className="flex items-center gap-1 text-xs px-2 py-1 bg-success/20 text-success rounded-full"><Wifi className="w-3 h-3" /> Live</span>}
            {wsStatus === 'connecting' && <span title="Connecting to Live Stream..." className="flex items-center gap-1 text-xs px-2 py-1 bg-warning/20 text-warning rounded-full"><Activity className="w-3 h-3 animate-spin" /> Connecting</span>}
            {(wsStatus === 'disconnected' || wsStatus === 'error') && <span title="Live Stream Disconnected" className="flex items-center gap-1 text-xs px-2 py-1 bg-danger/20 text-danger rounded-full"><WifiOff className="w-3 h-3" /> Offline</span>}
          </h1>
          <p className="text-text-muted text-sm mt-1">Review and manage system alerts and AI detections.</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col flex-1 relative">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-4 justify-between bg-surface-hover/30">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search by event type or camera ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-background border border-border rounded-md pl-3">
              <Filter className="w-4 h-4 text-text-muted" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent py-2 pr-3 text-sm focus:outline-none text-text"
              >
                <option value="all">All States</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            
            <select 
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
            >
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Severity</th>
                <th className="px-6 py-4 font-medium">Camera / Site</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Confidence</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    No events found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-text capitalize">
                      {event.event_type.replace(/_/g, ' ')}
                      {event.rule_id && <div className="text-xs text-text-muted mt-0.5 font-normal">Rule: {event.rule_id.substring(0,8)}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full capitalize",
                        event.severity === 'critical' || event.severity === 'high' ? "bg-danger/20 text-danger" :
                        event.severity === 'medium' ? "bg-warning/20 text-warning" :
                        "bg-primary/20 text-primary"
                      )}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-text">{event.camera_id?.substring(0, 8) || 'N/A'}</div>
                      <div className="text-xs">{event.site_id?.substring(0, 8) || 'Unknown Site'}</div>
                    </td>
                    <td className="px-6 py-4">{new Date(event.observed_at).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {event.confidence ? `${(event.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full uppercase",
                        event.state === 'OPEN' || event.state === 'NEW' ? "bg-danger/20 text-danger" :
                        event.state === 'CLOSED' ? "bg-success/20 text-success" :
                        "bg-warning/20 text-warning"
                      )}>
                        {event.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Evidence button is always available */}
                        <button 
                          onClick={() => setSelectedEvent(event)}
                          title="View Evidence" 
                          className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>

                        {/* Status specific actions */}
                        {(event.state === 'OPEN' || event.state === 'NEW') && (
                          <button 
                            onClick={() => handleAction(event.id, 'acknowledge')}
                            title="Acknowledge" 
                            className="p-1.5 text-text-muted hover:text-warning transition-colors rounded hover:bg-surface"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {(event.state === 'OPEN' || event.state === 'NEW' || event.state === 'ACKNOWLEDGED') && (
                          <button 
                            onClick={() => handleAction(event.id, 'assign')}
                            title="Assign to me" 
                            className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        {event.state !== 'CLOSED' && (
                          <button 
                            onClick={() => handleAction(event.id, 'close')}
                            title="Close Event" 
                            className="p-1.5 text-text-muted hover:text-success transition-colors rounded hover:bg-surface"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="p-4 border-t border-border flex justify-between items-center bg-surface-hover/30 text-sm text-text-muted">
          <span>Showing {filteredEvents.length} events</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-border rounded hover:bg-surface transition-colors disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border border-border rounded hover:bg-surface transition-colors disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>

      {/* Evidence Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-full animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/50">
              <div>
                <h3 className="text-lg font-medium text-text capitalize">
                  {selectedEvent.event_type.replace(/_/g, ' ')} Evidence
                </h3>
                <p className="text-xs text-text-muted">{new Date(selectedEvent.observed_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-text-muted hover:text-text bg-background p-1.5 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-text mb-3">Snapshot</h4>
                  <div className="aspect-video bg-black rounded-lg border border-border flex items-center justify-center overflow-hidden">
                    {/* Mock Snapshot Image */}
                    {selectedEvent.snapshot_url ? (
                      <img src={selectedEvent.snapshot_url} alt="Event Evidence" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-text-muted/50">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <span className="text-sm">No Snapshot Available</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-text mb-3">Video Clip</h4>
                  <div className="aspect-video bg-black rounded-lg border border-border flex items-center justify-center overflow-hidden">
                    {/* Mock Video Player */}
                    {selectedEvent.video_url ? (
                      <video src={selectedEvent.video_url} controls className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-text-muted/50">
                        <XCircle className="w-12 h-12 mb-2" />
                        <span className="text-sm">No Video Clip Available</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium text-text mb-3">Event Metadata</h4>
                <div className="bg-background border border-border rounded-lg p-4 font-mono text-xs overflow-x-auto text-text-muted">
                  <pre>{JSON.stringify(selectedEvent.metadata || { "info": "No additional metadata provided by AI engine." }, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
