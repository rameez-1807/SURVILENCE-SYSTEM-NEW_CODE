import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Car, 
  Activity,
  Image as ImageIcon,
  Video,
  Download
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setApiMissing(false);
      setError(null);
      
      const res = await api.get('/vehicles');
      setVehicles(res.data.items || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setApiMissing(true);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch vehicle history.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.number_plate?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || v.vehicle_type === typeFilter;
    const matchesCamera = cameraFilter === 'all' || v.camera_id === cameraFilter;
    const matchesDate = dateFilter === '' || v.timestamp?.startsWith(dateFilter);
    
    return matchesSearch && matchesType && matchesCamera && matchesDate;
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
            onClick={fetchVehicles}
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
            <Car className="w-6 h-6 text-primary" />
            Vehicle Intelligence
          </h1>
          <p className="text-text-muted text-sm mt-1">Automatic Number Plate Recognition (ANPR) and vehicle classification.</p>
        </div>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-hover text-text rounded-md transition-colors text-sm font-medium"
          onClick={() => alert('Export requires active backend API')}
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-0 flex-1">
        {/* Live Feed / Stats */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-[300px]">
            <div className="p-3 border-b border-border bg-surface-hover/30 flex justify-between items-center">
              <h3 className="text-sm font-medium text-text flex items-center gap-2">
                <Video className="w-4 h-4" /> Live ANPR Feed
              </h3>
              {!apiMissing && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-danger/20 text-danger text-xs font-bold rounded animate-pulse">
                  <span className="w-1.5 h-1.5 bg-danger rounded-full"></span>
                  LIVE
                </span>
              )}
            </div>
            <div className="flex-1 bg-black relative flex items-center justify-center">
              {apiMissing ? (
                <p className="text-text-muted text-xs px-4 text-center">Feed Offline</p>
              ) : (
                <p className="text-text-muted text-xs px-4 text-center">Select ANPR camera...</p>
              )}
              <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay"></div>
            </div>
          </div>
          
          <div className="bg-surface border border-border rounded-lg p-4 flex-1">
            <h3 className="text-sm font-medium text-text mb-4">Daily Statistics</h3>
            {apiMissing ? (
              <div className="text-center py-6 text-text-muted text-sm">Data unavailable</div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">Total Vehicles</span>
                  <span className="font-mono text-text">0</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">Unique Plates</span>
                  <span className="font-mono text-text">0</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">Watchlist Hits</span>
                  <span className="font-mono text-danger font-bold">0</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="xl:col-span-3 bg-surface border border-border rounded-lg overflow-hidden flex flex-col relative">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-4 justify-between bg-surface-hover/30 shrink-0">
            <div className="relative w-full lg:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search number plates..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted uppercase"
                disabled={apiMissing}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
                disabled={apiMissing}
              />
              
              <div className="flex items-center gap-2 bg-background border border-border rounded-md pl-3">
                <Filter className="w-4 h-4 text-text-muted" />
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent py-2 pr-3 text-sm focus:outline-none text-text capitalize"
                  disabled={apiMissing}
                >
                  <option value="all">All Vehicle Types</option>
                  <option value="car">Car</option>
                  <option value="truck">Truck</option>
                  <option value="bus">Bus</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="bicycle">Bicycle</option>
                </select>
              </div>
              
              <select 
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text"
                disabled={apiMissing}
              >
                <option value="all">All Cameras</option>
              </select>
            </div>
          </div>

          {/* Main Table Content */}
          <div className="flex-1 overflow-y-auto relative">
            {apiMissing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-surface/50 backdrop-blur-sm z-10">
                <Car className="w-16 h-16 text-text-muted/30 mb-4" />
                <h3 className="text-xl font-medium text-text mb-2">Backend Capability Required</h3>
                <p className="text-text-muted max-w-md mx-auto mb-6">
                  The ANPR and Vehicle Intelligence APIs (<code className="text-primary bg-primary/10 px-1 rounded">/api/v1/vehicles</code>) are not yet implemented on the server.
                  <br/><br/>
                  Please deploy the AI Vehicle Analysis module to enable this feature. No fake number plates are shown.
                </p>
              </div>
            ) : null}

            <table className={cn("w-full text-left text-sm text-text-muted", apiMissing && "opacity-20 pointer-events-none")}>
              <thead className="text-xs text-text uppercase bg-surface-hover border-b border-border sticky top-0 z-0">
                <tr>
                  <th className="px-6 py-3 font-medium">Plate Number</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Confidence</th>
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-6 py-3 font-medium">Camera / Site</th>
                  <th className="px-6 py-3 font-medium text-right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {!apiMissing && filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      No vehicle records found.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => (
                    <tr key={v.id} className="border-b border-border hover:bg-surface-hover/80 transition-colors group">
                      <td className="px-6 py-3">
                        <span className="font-mono text-text bg-background border border-border px-2 py-1 rounded font-bold tracking-wider">
                          {v.number_plate}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium text-text capitalize">
                        {v.vehicle_type}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                (v.confidence || 0) > 0.8 ? "bg-success" : (v.confidence || 0) > 0.5 ? "bg-warning" : "bg-danger"
                              )}
                              style={{ width: `${(v.confidence || 0) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{(v.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <div className="text-text">{v.camera_name || v.camera_id}</div>
                        <div className="text-xs">{v.site_name || v.site_id}</div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button 
                          title="View Evidence" 
                          className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface inline-flex"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {/* Dummy rows for visual structure when API is missing so table headers don't look empty */}
                {apiMissing && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
