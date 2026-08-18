import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Box, 
  Activity,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

export default function Objects() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableCameras, setAvailableCameras] = useState<string[]>([]);

  useEffect(() => {
    fetchDetections();
  }, []);

  const fetchDetections = async () => {
    try {
      setLoading(true);
      // We use the events API as the source of truth for detections
      const res = await api.get('/events?limit=200');
      
      const allEvents = res.data || [];
      // Filter only detection events (assuming they end with _detected or similar, 
      // or we just use all events as object detections if no strict typing exists)
      const detections = allEvents.filter((e: any) => e.event_type.includes('detected') || e.event_type.includes('object'));
      
      setEvents(detections);
      
      // Dynamically extract classes from backend data to avoid hardcoding
      const classes = new Set<string>();
      const cameras = new Set<string>();
      
      detections.forEach((e: any) => {
        const cls = e.event_type.replace('_detected', '').replace(/_/g, ' ');
        classes.add(cls);
        if (e.camera_id) cameras.add(e.camera_id);
      });
      
      setAvailableClasses(Array.from(classes));
      setAvailableCameras(Array.from(cameras));
      
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch detection history.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(evt => {
    const cls = evt.event_type.replace('_detected', '').replace(/_/g, ' ');
    const matchesSearch = cls.toLowerCase().includes(search.toLowerCase()) || 
                          evt.camera_id?.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || cls === classFilter;
    const matchesCamera = cameraFilter === 'all' || evt.camera_id === cameraFilter;
    
    return matchesSearch && matchesClass && matchesCamera;
  });

  if (loading) {
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="bg-surface border border-danger/50 rounded-lg p-8 max-w-md text-center">
          <Activity className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">Access Error</h2>
          <p className="text-text-muted">{error}</p>
          <button 
            onClick={fetchDetections}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Box className="w-6 h-6 text-primary" />
            Object Detection
          </h1>
          <p className="text-text-muted text-sm mt-1">Review AI object detection history and live feeds.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 flex-1">
        {/* Live Feed / Last Detection Preview */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-[400px]">
            <div className="p-3 border-b border-border bg-surface-hover/30 flex justify-between items-center">
              <h3 className="text-sm font-medium text-text flex items-center gap-2">
                <Video className="w-4 h-4" /> Live Detection Feed
              </h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-danger/20 text-danger text-xs font-bold rounded animate-pulse">
                <span className="w-1.5 h-1.5 bg-danger rounded-full"></span>
                LIVE
              </span>
            </div>
            <div className="flex-1 bg-black relative flex items-center justify-center">
              <p className="text-text-muted text-xs absolute z-10 px-4 text-center">
                Select a live view from the <br/> Live Monitoring wall to see real-time bounding boxes.
              </p>
              <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay"></div>
            </div>
          </div>
          
          <div className="bg-surface border border-border rounded-lg p-4 flex-1">
            <h3 className="text-sm font-medium text-text mb-4">Latest Detection Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Total Objects (24h)</span>
                <span className="font-mono text-text">{events.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Avg Confidence</span>
                <span className="font-mono text-text">
                  {events.length > 0 
                    ? (events.reduce((acc, val) => acc + (val.confidence || 0), 0) / events.length * 100).toFixed(1) + '%'
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="pt-3 border-t border-border mt-3">
                <h4 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Top Classes</h4>
                <div className="flex flex-wrap gap-2">
                  {availableClasses.slice(0, 5).map(cls => (
                    <span key={cls} className="px-2 py-1 bg-surface-hover border border-border rounded text-xs text-text capitalize">
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 justify-between bg-surface-hover/30 shrink-0">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-background border border-border rounded-md pl-3">
                <Filter className="w-4 h-4 text-text-muted" />
                <select 
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="bg-transparent py-2 pr-3 text-sm focus:outline-none text-text capitalize"
                >
                  <option value="all">All Classes</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <select 
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
              >
                <option value="all">All Cameras</option>
                {availableCameras.map(cam => (
                  <option key={cam} value={cam}>{cam.substring(0, 8)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 font-medium">Object Class</th>
                  <th className="px-6 py-3 font-medium">Confidence</th>
                  <th className="px-6 py-3 font-medium">Camera</th>
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-6 py-3 font-medium">BBox</th>
                  <th className="px-6 py-3 font-medium text-right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      No object detections found.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                      <td className="px-6 py-3 font-medium text-text capitalize">
                        {event.event_type.replace('_detected', '').replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                (event.confidence || 0) > 0.8 ? "bg-success" : (event.confidence || 0) > 0.5 ? "bg-warning" : "bg-danger"
                              )}
                              style={{ width: `${(event.confidence || 0) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{(event.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">{event.camera_id?.substring(0, 8) || 'N/A'}</td>
                      <td className="px-6 py-3">{new Date(event.observed_at).toLocaleString()}</td>
                      <td className="px-6 py-3 font-mono text-xs">
                        {/* We don't fake data. If backend doesn't provide bbox in event, show N/A */}
                        {event.metadata?.bounding_box ? `[${event.metadata.bounding_box.join(', ')}]` : 'N/A'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button 
                          title="View Evidence" 
                          className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface inline-flex"
                          onClick={() => alert(`Evidence reference: ${event.evidence_reference || 'None available'}`)}
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
