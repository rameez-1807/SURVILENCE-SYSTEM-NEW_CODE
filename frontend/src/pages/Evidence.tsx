import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Database, 
  Activity,
  Image as ImageIcon,
  Video,
  Download,
  Lock,
  Play
} from 'lucide-react';
import { api } from '../lib/api';

export default function Evidence() {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);

  useEffect(() => {
    fetchEvidence();
  }, []);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      setApiMissing(false);
      setError(null);
      
      // Attempt to fetch from evidence API
      const res = await api.get('/evidence');
      setEvidenceList(res.data.items || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setApiMissing(true);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch evidence library.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    alert("Secure download requires active backend Evidence API to generate signed URLs.");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg overflow-hidden h-64 flex flex-col">
              <div className="h-40 bg-surface-hover"></div>
              <div className="p-3 space-y-2">
                <div className="w-3/4 h-4 bg-surface-hover rounded"></div>
                <div className="w-1/2 h-3 bg-surface-hover rounded"></div>
              </div>
            </div>
          ))}
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
            onClick={fetchEvidence}
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
            <Database className="w-6 h-6 text-primary" />
            Evidence Center
          </h1>
          <p className="text-text-muted text-sm mt-1">Securely search, preview, and download retained event evidence.</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col flex-1 relative">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-4 justify-between bg-surface-hover/30 shrink-0">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search by event, employee, or vehicle..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
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
                <option value="all">All Media</option>
                <option value="snapshot">Snapshots</option>
                <option value="video">Video Clips</option>
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

        {/* Evidence Grid / List */}
        <div className="flex-1 overflow-y-auto p-6 relative bg-background">
          {apiMissing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-surface/80 backdrop-blur-sm z-10">
              <Database className="w-16 h-16 text-text-muted/30 mb-4" />
              <h3 className="text-xl font-medium text-text mb-2">Backend Capability Required</h3>
              <p className="text-text-muted max-w-md mx-auto mb-6">
                The Secure Evidence API (<code className="text-primary bg-primary/10 px-1 rounded">/api/v1/evidence</code>) is not yet implemented on the server.
                <br/><br/>
                Please deploy the Evidence & Storage module to enable secure evidence retrieval and signed URLs. No permanent public URLs will be exposed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {evidenceList.length === 0 ? (
                <div className="col-span-full text-center py-12 text-text-muted">
                  No evidence found matching your criteria.
                </div>
              ) : (
                evidenceList.map((item) => (
                  <div key={item.id} className="bg-surface border border-border rounded-lg overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedEvidence(item)}>
                    <div className="aspect-video bg-black relative">
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white flex items-center gap-1">
                        {item.media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                        {item.media_type}
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-primary/80 backdrop-blur-sm rounded text-[10px] font-bold text-white capitalize">
                        {item.detection_type}
                      </div>
                      
                      {/* Placeholder for media thumbnail */}
                      <div className="w-full h-full flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity">
                        {item.media_type === 'video' ? <Play className="w-12 h-12 text-white" /> : <ImageIcon className="w-12 h-12 text-white" />}
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <div className="text-sm font-medium text-text mb-1 truncate">{item.event_name}</div>
                      <div className="text-xs text-text-muted mb-2">{new Date(item.timestamp).toLocaleString()}</div>
                      
                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Camera:</span>
                          <span className="text-text truncate ml-2">{item.camera_name}</span>
                        </div>
                        {item.employee_info && (
                          <div className="flex justify-between text-xs">
                            <span className="text-text-muted">Employee:</span>
                            <span className="text-primary truncate ml-2 font-medium">{item.employee_info}</span>
                          </div>
                        )}
                        {item.vehicle_info && (
                          <div className="flex justify-between text-xs">
                            <span className="text-text-muted">Plate:</span>
                            <span className="text-text bg-background border border-border px-1 rounded font-mono truncate ml-2">{item.vehicle_info}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="pt-3 border-t border-border flex justify-end">
                        <button 
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                          }}
                        >
                          <Lock className="w-3 h-3" />
                          Secure Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-full animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/50">
              <div>
                <h3 className="text-lg font-medium text-text capitalize">
                  Evidence Preview
                </h3>
                <p className="text-xs text-text-muted">{new Date(selectedEvidence.timestamp).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedEvidence(null)}
                className="text-text-muted hover:text-text bg-background p-1.5 rounded-md"
              >
                Close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="aspect-video bg-black rounded-lg border border-border flex items-center justify-center overflow-hidden mb-6 relative">
                <div className="text-white/30 flex flex-col items-center">
                  <Lock className="w-12 h-12 mb-2" />
                  <span>Secure Evidence Vault</span>
                  <span className="text-xs mt-1">Signed URL generation required for playback.</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-background border border-border rounded-lg p-4 text-sm">
                <div>
                  <div className="text-text-muted text-xs mb-1">Event Type</div>
                  <div className="font-medium text-text capitalize">{selectedEvidence.detection_type}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Camera</div>
                  <div className="font-medium text-text">{selectedEvidence.camera_name}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Employee</div>
                  <div className="font-medium text-text">{selectedEvidence.employee_info || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Vehicle / Plate</div>
                  <div className="font-medium font-mono text-text">{selectedEvidence.vehicle_info || 'N/A'}</div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button 
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors font-medium shadow-lg shadow-primary/20"
                  onClick={() => handleDownload()}
                >
                  <Download className="w-4 h-4" />
                  Generate Signed URL & Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
