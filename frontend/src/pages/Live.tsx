import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MonitorPlay,
  Grid,
  LayoutGrid,
  Maximize2,
  RefreshCw,
  VideoOff,
  Activity,
  X,
  Radio,
  Scan,
  Zap,
  Layers
} from 'lucide-react';
import { api, getWsUrl } from '../lib/api';
import { cn } from '../utils/cn';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';
import { Badge } from '../components/ui/Badge';

export default function Live() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  
  const [layout, setLayout] = useState<1 | 4 | 9>(4);
  const [activeCameras, setActiveCameras] = useState<(any | null)[]>(Array(4).fill(null));
  
  // Face Recognition Modal
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);

  // Store the latest detection event for each camera
  const [latestDetections, setLatestDetections] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchCameras();
    
    // Connect to WS for live detections
    const token = localStorage.getItem('token') || 'dummy-token';
    const ws = new WebSocket(getWsUrl(`/api/v1/ws?token=${token}`));
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const payload = msg.data || msg;
        
        if (msg.type === 'live_detections' && payload.camera_id) {
          setLatestDetections(prev => ({
            ...prev,
            [payload.camera_id]: payload.detections
          }));
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    return () => ws.close();
  }, []);

  // Update active cameras array size when layout changes
  useEffect(() => {
    setActiveCameras(prev => {
      const newArray = Array(layout).fill(null);
      for (let i = 0; i < Math.min(prev.length, layout); i++) {
        newArray[i] = prev[i];
      }
      return newArray;
    });
  }, [layout]);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras');
      const items = res.data.items || [];
      setCameras(items);

      // Auto-populate active slots if empty
      setActiveCameras(prev => {
        const updated = [...prev];
        items.slice(0, layout).forEach((cam: any, idx: number) => {
          if (!updated[idx]) updated[idx] = cam;
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to fetch cameras', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(search.toLowerCase());
    const matchesSite = siteFilter === 'all' || cam.site_id === siteFilter;
    return matchesSearch && matchesSite;
  });

  const uniqueSites = Array.from(new Set(cameras.map(c => c.site_id).filter(Boolean)));

  const handleDragStart = (e: React.DragEvent, camera: any) => {
    e.dataTransfer.setData('camera', JSON.stringify(camera));
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const cameraData = e.dataTransfer.getData('camera');
    if (cameraData) {
      const camera = JSON.parse(cameraData);
      setActiveCameras(prev => {
        const newCams = [...prev];
        const existingIndex = newCams.findIndex(c => c?.id === camera.id);
        if (existingIndex !== -1) {
          newCams[existingIndex] = null;
        }
        newCams[index] = camera;
        return newCams;
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeCamera = (index: number) => {
    setActiveCameras(prev => {
      const newCams = [...prev];
      newCams[index] = null;
      return newCams;
    });
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('cctv-wall');
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-4 sm:gap-5 animate-fade-in select-none">
      {/* Left Sidebar - Camera Matrix Selector */}
      <div className="w-full md:w-80 flex flex-col glass-card rounded-2xl border border-border/80 overflow-hidden shrink-0">
        <div className="p-4 border-b border-border/60 bg-surface/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Camera Feeds</h2>
            </div>
            <Badge variant="cyan" size="xs">
              {cameras.length} NODES
            </Badge>
          </div>

          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Filter feeds..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            {uniqueSites.length > 0 && (
              <div className="relative">
                <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <select 
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                >
                  <option value="all">All Sectors</option>
                  {uniqueSites.map((site: any) => (
                    <option key={site} value={site}>Sector: {site.substring(0, 10)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Camera List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-hide">
          {loading ? (
            <div className="text-center py-8 text-text-muted text-xs font-mono">
              Interrogating camera nodes...
            </div>
          ) : filteredCameras.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs">
              No matching feeds found
            </div>
          ) : (
            filteredCameras.map((camera) => {
              const isActive = camera.status === 'active';
              return (
                <div 
                  key={camera.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, camera)}
                  className="p-3 bg-surface/40 hover:bg-surface-hover/80 border border-border/60 hover:border-cyan-500/40 rounded-xl cursor-grab active:cursor-grabbing transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-2 w-2 shrink-0">
                        {isActive && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={cn('relative inline-flex rounded-full h-2 w-2', isActive ? 'bg-emerald-400' : 'bg-rose-500')}></span>
                      </span>
                      <span className="text-xs font-semibold text-text truncate max-w-[170px] group-hover:text-cyan-300 transition-colors">
                        {camera.name}
                      </span>
                    </div>
                    <MonitorPlay className="w-3.5 h-3.5 text-text-muted group-hover:text-cyan-400 transition-colors" />
                  </div>

                  <div className="text-[10px] font-mono text-text-dim mt-1.5 flex items-center justify-between">
                    <span className="truncate max-w-[130px]">{camera.host || '127.0.0.1'}</span>
                    <span className="uppercase text-cyan-400/80">{camera.protocol || 'RTSP'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2.5 bg-[#050811]/60 border-t border-border/60 text-[10px] font-mono text-text-muted text-center flex items-center justify-center gap-1.5">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>Drag node to assign grid slot</span>
        </div>
      </div>

      {/* Main CCTV Wall Area */}
      <div className="flex-1 flex flex-col min-w-0 glass-card rounded-2xl border border-border/80 overflow-hidden shadow-2xl">
        {/* Wall Toolbar */}
        <div className="p-3 border-b border-border/60 bg-surface/50 flex flex-wrap gap-2 justify-between items-center">
          {/* Layout buttons */}
          <div className="flex items-center gap-1 bg-surface/80 p-1 rounded-xl border border-border/80">
            <button 
              onClick={() => setLayout(1)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 1 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="1 Feed Solo"
            >
              <div className="w-3 h-3 border border-current rounded-sm"></div>
              <span>1x1</span>
            </button>
            <button 
              onClick={() => setLayout(4)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 4 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="4 Feeds Quad"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>2x2</span>
            </button>
            <button 
              onClick={() => setLayout(9)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 9 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="9 Feeds Matrix"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>3x3</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
            >
              <Scan className="w-3.5 h-3.5 animate-pulse" />
              <span>Webcam AI Face Rec</span>
            </button>

            <button 
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
              title="Fullscreen Matrix"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Grid Wall */}
        <div id="cctv-wall" className="flex-1 bg-[#030611] p-2.5 overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-cyber-grid opacity-15 pointer-events-none" />

          <div className={cn(
            "flex-1 grid gap-2.5 relative z-10",
            layout === 1 ? "grid-cols-1 grid-rows-1" :
            layout === 4 ? "grid-cols-2 grid-rows-2" :
            "grid-cols-3 grid-rows-3"
          )}>
            {activeCameras.map((camera, index) => (
              <div 
                key={index}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                className="bg-[#070b16] rounded-xl overflow-hidden relative group flex flex-col border border-border/60 hover:border-cyan-500/40 transition-colors shadow-inner"
              >
                {camera ? (
                  <CameraStream 
                    camera={camera} 
                    onRemove={() => removeCamera(index)} 
                    latestDetection={latestDetections[camera.id]} 
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-text-dim border border-dashed border-border/60 rounded-xl m-1 bg-[#040814]/60">
                    <VideoOff className="w-7 h-7 mb-2 text-text-dim/60" />
                    <span className="text-xs font-mono font-semibold tracking-wider text-text-muted">SLOT {index + 1} UNASSIGNED</span>
                    <span className="text-[10px] text-text-dim font-mono mt-0.5">Drag feed here to monitor</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FaceRecognitionModal 
        isOpen={isFaceModalOpen} 
        onClose={() => setIsFaceModalOpen(false)} 
      />
    </div>
  );
}

// Sub-component for individual camera stream
function CameraStream({ camera, onRemove, latestDetection }: { camera: any, onRemove: () => void, latestDetection?: any }) {
  const [streamInfo, setStreamInfo] = useState<{ url: string, token: string } | null>(null);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [health, setHealth] = useState<{ status: string, latency: number } | null>(null);

  useEffect(() => {
    connectStream();
    const healthInterval = setInterval(() => {
      checkHealth();
    }, 10000);
    return () => clearInterval(healthInterval);
  }, [camera.id]);

  const connectStream = async () => {
    setStreamStatus('connecting');
    try {
      const res = await api.post(`/cameras/${camera.id}/preview-token`);
      setStreamInfo({ url: res.data.preview_url, token: res.data.token });
      setTimeout(() => setStreamStatus('live'), 1000);
      checkHealth();
    } catch (err) {
      setStreamStatus('error');
    }
  };

  const checkHealth = async () => {
    try {
      const res = await api.get(`/cameras/${camera.id}/health`);
      setHealth({ status: res.data.status, latency: res.data.latency_ms });
    } catch (err) {
      // ignore
    }
  };

  return (
    <>
      {/* Cyber Corner Brackets */}
      <div className="pointer-events-none absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-cyan-400/70 z-20" />
      <div className="pointer-events-none absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-cyan-400/70 z-20" />
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-cyan-400/70 z-20" />
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-cyan-400/70 z-20" />

      {/* Stream Overlay HUD Header */}
      <div className="absolute top-0 inset-x-0 p-2.5 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex justify-between items-start z-10 opacity-90 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-xs font-bold truncate max-w-[180px] drop-shadow font-mono">
              {camera.name}
            </span>
          </div>
          {health && (
            <span className="text-[10px] font-mono text-emerald-400 drop-shadow">
              {health.latency}ms • {health.status?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={connectStream}
            className="p-1 rounded-lg bg-black/60 hover:bg-cyan-500/20 text-white/80 hover:text-cyan-300 border border-white/10 backdrop-blur-md transition-colors"
            title="Reconnect Node"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", streamStatus === 'connecting' && "animate-spin")} />
          </button>
          <button 
            onClick={onRemove}
            className="p-1 rounded-lg bg-black/60 hover:bg-rose-500/20 text-white/80 hover:text-rose-400 border border-white/10 backdrop-blur-md transition-colors"
            title="Detach Slot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stream Badges */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
        {streamStatus === 'live' && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-600/90 text-white text-[10px] font-mono font-bold rounded border border-rose-400/30 shadow-lg shadow-rose-600/40">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
            LIVE
          </span>
        )}
      </div>

      {/* Video Content Area */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
        {streamStatus === 'connecting' ? (
          <div className="flex flex-col items-center text-text-muted p-4">
            <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2.5"></div>
            <span className="text-xs font-mono text-cyan-300">ESTABLISHING RTSP PIPELINE...</span>
          </div>
        ) : streamStatus === 'error' ? (
          <div className="flex flex-col items-center text-rose-400 p-4">
            <Activity className="w-7 h-7 mb-2 opacity-60" />
            <span className="text-xs font-mono">NODE FEED OFFLINE</span>
            <button 
              onClick={connectStream}
              className="mt-2 text-[11px] underline hover:text-rose-300 font-mono"
            >
              Re-attempt handshake
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-[#050914]">
            {/* Visual Stream Simulation Frame */}
            <div className="absolute inset-0 bg-cyber-grid opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-950/30 via-transparent to-cyan-950/20" />
            
            {/* Real-time radar sweep laser */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-laser-sweep opacity-40 pointer-events-none" />

            <div className="flex flex-col items-center justify-center font-mono text-[11px] text-white/30 space-y-1 select-none pointer-events-none">
              <Radio className="w-8 h-8 text-cyan-500/40 animate-pulse" />
              <span>ACTIVE RTSP STREAM // 1080P @ 30FPS</span>
              <span className="text-[9px] text-white/20">{streamInfo?.url || 'STREAM_SESSION_ONLINE'}</span>
            </div>
            
            {/* Bounding Box Overlay based on detection inference data */}
            {latestDetection && Array.isArray(latestDetection) && latestDetection.map((det, idx) => (
              <div 
                key={det.track_id || idx}
                className="absolute border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-75"
                style={{
                  left: `${det.bbox.x1 * 100}%`,
                  top: `${det.bbox.y1 * 100}%`,
                  width: `${(det.bbox.x2 - det.bbox.x1) * 100}%`,
                  height: `${(det.bbox.y2 - det.bbox.y1) * 100}%`
                }}
              >
                <div className="absolute -top-5 left-[-2px] bg-cyan-500 text-black text-[9px] font-mono font-bold px-1.5 py-0.5 whitespace-nowrap capitalize rounded-t">
                  {det.class_name?.replace(/_/g, ' ')} {((det.confidence || 0.95) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
