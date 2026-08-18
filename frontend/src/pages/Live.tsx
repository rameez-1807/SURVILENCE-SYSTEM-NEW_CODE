import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MonitorPlay,
  Grid,
  LayoutGrid,
  Maximize,
  RefreshCw,
  VideoOff,
  Activity,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';

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
    const ws = new WebSocket(`ws://localhost:8000/api/v1/ws?token=${token}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.camera_id && (data.event_type.includes('detected') || data.event_type.includes('object'))) {
          setLatestDetections(prev => ({
            ...prev,
            [data.camera_id]: data
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
      setCameras(res.data.items || []);
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
        // If camera is already in another slot, remove it from there
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
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-fade-in">
      {/* Left Sidebar - Camera Selector */}
      <div className="w-full md:w-72 flex flex-col bg-surface border border-border rounded-lg overflow-hidden shrink-0">
        <div className="p-4 border-b border-border bg-surface-hover/30">
          <h2 className="text-lg font-medium text-text mb-3">Available Cameras</h2>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <select 
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text appearance-none"
              >
                <option value="all">All Sites</option>
                {uniqueSites.map((site: any) => (
                  <option key={site} value={site}>Site: {site.substring(0, 8)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="text-center p-4 text-text-muted text-sm">Loading...</div>
          ) : filteredCameras.length === 0 ? (
            <div className="text-center p-4 text-text-muted text-sm">No cameras found</div>
          ) : (
            filteredCameras.map((camera) => (
              <div 
                key={camera.id}
                draggable
                onDragStart={(e) => handleDragStart(e, camera)}
                className="p-3 bg-background border border-border rounded-md hover:border-primary/50 cursor-grab active:cursor-grabbing transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      camera.status === 'active' ? "bg-success" : "bg-danger"
                    )}></div>
                    <span className="text-sm font-medium text-text">{camera.name}</span>
                  </div>
                  <MonitorPlay className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                </div>
                <div className="text-xs text-text-muted mt-1 ml-4 flex justify-between">
                  <span>{camera.host}</span>
                  <span className="uppercase">{camera.protocol}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 bg-surface-hover/50 border-t border-border text-xs text-text-muted text-center">
          Drag and drop cameras to the grid
        </div>
      </div>

      {/* Main CCTV Wall */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-border bg-surface-hover/30 flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              onClick={() => setLayout(1)}
              className={cn("p-1.5 rounded-md transition-colors", layout === 1 ? "bg-primary text-white" : "bg-background text-text-muted hover:text-text")}
              title="1 Camera"
            >
              <div className="w-5 h-5 border-2 border-current rounded-sm"></div>
            </button>
            <button 
              onClick={() => setLayout(4)}
              className={cn("p-1.5 rounded-md transition-colors", layout === 4 ? "bg-primary text-white" : "bg-background text-text-muted hover:text-text")}
              title="4 Cameras"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setLayout(9)}
              className={cn("p-1.5 rounded-md transition-colors", layout === 9 ? "bg-primary text-white" : "bg-background text-text-muted hover:text-text")}
              title="9 Cameras"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFaceModalOpen(true)}
              className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-md transition-colors flex items-center gap-2 px-3 text-sm font-medium border border-primary/20"
            >
              <Activity className="w-4 h-4" />
              Webcam Face Rec
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-1.5 bg-background text-text-muted hover:text-text rounded-md transition-colors flex items-center gap-2 px-3 text-sm font-medium border border-border"
            >
              <Maximize className="w-4 h-4" />
              Fullscreen
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div id="cctv-wall" className="flex-1 bg-black p-2 overflow-hidden flex flex-col">
          <div className={cn(
            "flex-1 grid gap-2",
            layout === 1 ? "grid-cols-1 grid-rows-1" :
            layout === 4 ? "grid-cols-2 grid-rows-2" :
            "grid-cols-3 grid-rows-3"
          )}>
            {activeCameras.map((camera, index) => (
              <div 
                key={index}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                className="bg-surface-hover rounded-md overflow-hidden relative group flex flex-col"
              >
                {camera ? (
                  <CameraStream 
                    camera={camera} 
                    onRemove={() => removeCamera(index)} 
                    latestDetection={latestDetections[camera.id]} 
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-border border-2 border-dashed border-border rounded-md m-1">
                    <VideoOff className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-sm font-medium opacity-50">Empty Slot</span>
                    <span className="text-xs opacity-40 mt-1">Drag camera here</span>
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
    
    // Periodically check health (simulated via API)
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
      // Simulate connection delay for WSS handshake
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
      {/* Stream Overlay UI */}
      <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col">
          <span className="text-white text-sm font-semibold truncate max-w-[200px] drop-shadow-md">
            {camera.name}
          </span>
          {health && (
            <span className="text-xs font-mono text-success drop-shadow-md">
              {health.latency}ms | {health.status}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={connectStream}
            className="p-1.5 bg-black/50 text-white hover:text-primary rounded backdrop-blur-sm transition-colors"
            title="Reconnect"
          >
            <RefreshCw className={cn("w-4 h-4", streamStatus === 'connecting' && "animate-spin")} />
          </button>
          <button 
            onClick={onRemove}
            className="p-1.5 bg-black/50 text-white hover:text-danger rounded backdrop-blur-sm transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="absolute bottom-2 right-2 z-10 flex gap-2">
        {streamStatus === 'live' && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-danger text-white text-xs font-bold rounded animate-pulse">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            LIVE
          </span>
        )}
      </div>

      {/* Video Content Area */}
      <div className="flex-1 flex items-center justify-center bg-[#111]">
        {streamStatus === 'connecting' ? (
          <div className="flex flex-col items-center text-text-muted">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-sm font-medium">Establishing secure connection...</span>
          </div>
        ) : streamStatus === 'error' ? (
          <div className="flex flex-col items-center text-danger">
            <Activity className="w-8 h-8 mb-3 opacity-50" />
            <span className="text-sm font-medium">Failed to load stream</span>
            <button 
              onClick={connectStream}
              className="mt-2 text-xs underline hover:text-danger/80"
            >
              Retry
            </button>
          </div>
        ) : (
          // Simulated Video Player
          <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-blue-900/20 mix-blend-overlay"></div>
            {/* Simulated Stream Details */}
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/20 select-none">
              {streamInfo?.url}
            </div>
            
            {/* Bounding Box Overlay based on actual data if provided by backend */}
            {latestDetection?.metadata?.bounding_box && (
              <div 
                className="absolute border-2 border-primary bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300"
                style={{
                  left: `${latestDetection.metadata.bounding_box[0] * 100}%`,
                  top: `${latestDetection.metadata.bounding_box[1] * 100}%`,
                  width: `${(latestDetection.metadata.bounding_box[2] - latestDetection.metadata.bounding_box[0]) * 100}%`,
                  height: `${(latestDetection.metadata.bounding_box[3] - latestDetection.metadata.bounding_box[1]) * 100}%`
                }}
              >
                <div className="absolute -top-6 left-[-2px] bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap capitalize">
                  {latestDetection.event_type.replace('_detected', '').replace(/_/g, ' ')} {(latestDetection.confidence * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
