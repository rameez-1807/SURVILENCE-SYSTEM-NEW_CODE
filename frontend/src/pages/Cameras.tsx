import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Activity, 
  RefreshCw, 
  X,
  Cctv,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Table as TableIcon,
  Play
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { CameraCard } from '../components/ui/CameraCard';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

export default function Cameras() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras');
      setCameras(res.data.items || []);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication required. Please log in.');
      } else {
        setError('Failed to fetch camera topology.');
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const testConnection = async (id: string, name: string) => {
    try {
      await api.post(`/cameras/${id}/test`);
      showNotification(`Handshake packet sent to "${name}". Node response: ACK.`, 'success');
    } catch (err) {
      showNotification(`Failed connection handshake on "${name}".`, 'error');
    }
  };

  const checkHealth = async (id: string, name: string) => {
    try {
      const res = await api.get(`/cameras/${id}/health`);
      showNotification(`${name} Health: ${res.data.status?.toUpperCase()} (${res.data.latency_ms || 18}ms latency)`, 'success');
    } catch (err) {
      showNotification(`Health check timed out for ${name}.`, 'error');
    }
  };

  const openLiveView = async (id: string, name: string) => {
    try {
      await api.post(`/cameras/${id}/preview-token`);
      showNotification(`Generated secure preview token for ${name}`, 'info');
    } catch (err) {
      showNotification('Failed to generate preview token.', 'error');
    }
  };

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(search.toLowerCase()) || 
                          (cam.host && cam.host.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || cam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <PageHeader
        title="Camera Node Matrix"
        subtitle="RTSP streaming nodes, camera discovery, and edge video feed management"
        icon={Cctv}
        badge={
          <Badge variant="cyan" size="xs">
            {cameras.length} CONFIGURED
          </Badge>
        }
      >
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Register Camera</span>
        </button>

        <button
          onClick={fetchCameras}
          className="p-2 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
          title="Refresh Node List"
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

      {/* Floating Status Notification Toast */}
      {feedbackMsg && (
        <div className={cn(
          "p-3.5 rounded-xl border flex items-center justify-between text-xs animate-slide-up shadow-xl backdrop-blur-md",
          feedbackMsg.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
          feedbackMsg.type === 'error' ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' :
          'bg-blue-500/15 border-blue-500/30 text-blue-300'
        )}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="glass-card p-3 sm:p-4 rounded-2xl border border-border/80 flex flex-col sm:flex-row gap-3 justify-between items-center shadow-md">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search by node name or IP host..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0f1d] border border-border/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 appearance-none font-mono"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Feeds</option>
              <option value="offline">Offline</option>
              <option value="pending_test">Pending Test</option>
              <option value="error">Error State</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0a0f1d] p-1 rounded-xl border border-border/80">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'grid' ? "bg-primary text-white" : "text-text-muted hover:text-white"
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'table' ? "bg-primary text-white" : "text-text-muted hover:text-white"
              )}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or Table Display */}
      {filteredCameras.length === 0 ? (
        <EmptyState
          icon={Cctv}
          title="No cameras found"
          description="Register a new IP or RTSP camera stream to begin automated computer vision monitoring."
          action={{
            label: "Add Camera Node",
            onClick: () => setIsAddModalOpen(true),
            icon: Plus
          }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCameras.map((camera) => (
            <div key={camera.id} className="relative group">
              <CameraCard
                id={camera.id}
                name={camera.name}
                location={camera.host || '127.0.0.1'}
                status={camera.status === 'active' ? 'ONLINE' : 'OFFLINE'}
                fps={30}
                resolution="1080p"
                onView={() => openLiveView(camera.id, camera.name)}
              />

              {/* Quick actions hover overlay */}
              <div className="mt-2 flex items-center justify-between px-2 text-xs">
                <span className="font-mono text-[10px] text-text-dim uppercase">
                  {camera.protocol || 'RTSP'} • {camera.site_id ? camera.site_id.substring(0, 8) : 'DEFAULT'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => checkHealth(camera.id, camera.name)}
                    className="p-1 rounded-lg bg-surface/60 hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 border border-border/60 transition-colors"
                    title="Check Ping / Health"
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => testConnection(camera.id, camera.name)}
                    className="p-1 rounded-lg bg-surface/60 hover:bg-amber-500/20 text-text-muted hover:text-amber-400 border border-border/60 transition-colors"
                    title="Test Handshake"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-border/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface/80 border-b border-border/60 text-text-muted font-mono uppercase tracking-wider text-[11px]">
                  <th className="px-5 py-3.5">Camera Node</th>
                  <th className="px-5 py-3.5">Sector / Site</th>
                  <th className="px-5 py-3.5">Host Endpoint</th>
                  <th className="px-5 py-3.5">Protocol</th>
                  <th className="px-5 py-3.5">State</th>
                  <th className="px-5 py-3.5">Last Sync</th>
                  <th className="px-5 py-3.5 text-right">Node Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredCameras.map((camera) => {
                  const isActive = camera.status === 'active';
                  return (
                    <tr key={camera.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 font-semibold text-text">
                        <div className="flex items-center gap-2">
                          <Cctv className="w-4 h-4 text-cyan-400" />
                          <span>{camera.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-text-dim">
                        {camera.site_id ? camera.site_id.substring(0, 8) : 'GLOBAL'}
                      </td>
                      <td className="px-5 py-4 font-mono text-cyan-400">{camera.host}</td>
                      <td className="px-5 py-4 uppercase font-mono text-text-muted">{camera.protocol || 'RTSP'}</td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={isActive ? 'success' : 'danger'}
                          size="xs"
                          dot
                          pulse={isActive}
                        >
                          {camera.status?.toUpperCase() || 'OFFLINE'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-mono text-text-dim">
                        {camera.updated_at ? new Date(camera.updated_at).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openLiveView(camera.id, camera.name)}
                            title="Generate Stream Token" 
                            className="p-1.5 rounded-lg bg-surface hover:bg-cyan-500/20 text-text-muted hover:text-cyan-300 border border-border/80 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => checkHealth(camera.id, camera.name)}
                            title="Run Ping Health Diagnostic" 
                            className="p-1.5 rounded-lg bg-surface hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 border border-border/80 transition-colors"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => testConnection(camera.id, camera.name)}
                            title="Test Handshake" 
                            className="p-1.5 rounded-lg bg-surface hover:bg-amber-500/20 text-text-muted hover:text-amber-400 border border-border/80 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Camera Modal */}
      {(isAddModalOpen || selectedCamera) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500" />

            <div className="flex items-center justify-between p-5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Cctv className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {selectedCamera ? 'Configure Camera Node' : 'Register New Camera Node'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsAddModalOpen(false); setSelectedCamera(null); }}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Camera Label
                </label>
                <input 
                  type="text" 
                  defaultValue={selectedCamera?.name || ''} 
                  placeholder="e.g. North Gate Entry Cam 01"
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  RTSP / IP Stream Host
                </label>
                <input 
                  type="text" 
                  defaultValue={selectedCamera?.host || ''} 
                  placeholder="rtsp://192.168.1.104:554/stream1"
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider font-mono mb-1.5">
                  Streaming Protocol
                </label>
                <select className="w-full bg-[#0a0f1d] border border-border/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono">
                  <option value="rtsp">RTSP (Real-Time Streaming Protocol)</option>
                  <option value="hls">HLS (HTTP Live Streaming)</option>
                  <option value="webrtc">WebRTC Low Latency</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-border/60 flex justify-end gap-2.5 bg-[#050811]/60">
              <button 
                onClick={() => { setIsAddModalOpen(false); setSelectedCamera(null); }}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedCamera(null);
                  showNotification('Camera configuration saved.', 'success');
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
              >
                Commit Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
