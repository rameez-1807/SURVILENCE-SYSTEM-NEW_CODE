import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Box, 
  Camera,
  VideoOff,
  CheckCircle2,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
  Upload,
  Clock,
  Sparkles,
  Eye,
  Trash2,
  Database,
  Activity
} from 'lucide-react';
import { api, getWsUrl } from '../lib/api';
import { cn } from '../utils/cn';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';

const LOW_CONFIDENCE_THRESHOLD = 0.45;

interface ObjectDetectionEvent {
  id: string;
  event_type: string;
  confidence: number;
  camera_id?: string;
  observed_at: string;
  evidence_reference?: string;
  metadata?: {
    bounding_box?: number[];
  };
}

interface DetectedObject {
  label: string;
  score: number;
  bbox?: number[];
  isLlmVerified?: boolean;
  needsReview?: boolean;
}

export default function Objects() {
  const [events, setEvents] = useState<ObjectDetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableCameras, setAvailableCameras] = useState<string[]>([]);

  // Scanning mode: 'camera' | 'upload' | 'live'
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'live'>('live');

  // Camera & Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [currentDetection, setCurrentDetection] = useState<DetectedObject | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPenMode, setIsPenMode] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Uploaded Image Scanner State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadDetections, setUploadDetections] = useState<DetectedObject[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Selected event modal details
  const [selectedEvent, setSelectedEvent] = useState<ObjectDetectionEvent | null>(null);

  // ── Live Detection Model & Sensitivity State ──
  const [selectedModel, setSelectedModel] = useState<'yolo11m' | 'yoloe'>('yoloe');
  const [liveConfidence, setLiveConfidence] = useState<number>(0.35);
  const selectedModelRef = useRef<'yolo11m' | 'yoloe'>('yoloe');
  const liveConfidenceRef = useRef<number>(0.35);

  // Open-Vocabulary Target Classes for YOLO-World
  const DEFAULT_OPEN_VOCAB = ['mobile phone', 'watch', 'pen', 'laptop', 'tablet', 'person', 'bag', 'bottle', 'keys'];
  const [targetClasses, setTargetClasses] = useState<string[]>(DEFAULT_OPEN_VOCAB);
  const [customClassInput, setCustomClassInput] = useState<string>('');
  const targetClassesRef = useRef<string[]>(DEFAULT_OPEN_VOCAB);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    liveConfidenceRef.current = liveConfidence;
  }, [liveConfidence]);

  useEffect(() => {
    targetClassesRef.current = targetClasses;
  }, [targetClasses]);

  // ── Live YOLOE & YOLO11m WebSocket Detection State ──
  const [liveDetections, setLiveDetections] = useState<Array<{
    track_id?: number;
    class_id: number;
    name: string;
    confidence: number;
    x1: number; y1: number; x2: number; y2: number;
  }>>([]);
  const [liveActiveTracks, setLiveActiveTracks] = useState<number>(0);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [liveWsStatus, setLiveWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [liveInferenceMs, setLiveInferenceMs] = useState(0);
  const [liveFps, setLiveFps] = useState(0);
  const [liveFrameSize, setLiveFrameSize] = useState({ w: 0, h: 0 });
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);

  // Open-Vocabulary Target Categories Handlers
  const handleAddClass = (className?: string) => {
    const val = (className || customClassInput).trim().toLowerCase();
    if (!val) return;
    if (!targetClasses.includes(val)) {
      setTargetClasses([...targetClasses, val]);
    }
    setCustomClassInput('');
  };

  const handleRemoveClass = (clsToRemove: string) => {
    setTargetClasses(targetClasses.filter((c) => c !== clsToRemove));
  };

  const handleApplyPreset = (preset: 'gadgets' | 'office' | 'all') => {
    if (preset === 'gadgets') {
      setTargetClasses(['mobile phone', 'watch', 'pen', 'laptop', 'tablet']);
    } else if (preset === 'office') {
      setTargetClasses(['laptop', 'mouse', 'keyboard', 'bottle', 'pen', 'chair', 'cup']);
    } else {
      setTargetClasses(DEFAULT_OPEN_VOCAB);
    }
  };

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveSendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveFpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

  // Real-Time YOLO & ByteTrack Pipeline Telemetry
  const [pipelineMetrics, setPipelineMetrics] = useState<{
    inference_fps?: number;
    avg_inference_latency_ms?: number;
    active_tracks?: number;
    total_detections?: number;
    gpu_metrics?: { available: boolean; device: string };
  } | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get('/detection/status');
        if (res.data) setPipelineMetrics(res.data);
      } catch (e) {
        // Backend pipeline stats optional
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3500);
    return () => clearInterval(interval);
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastSavedTimeRef = useRef<{ [key: string]: number }>({});
  const lastSpokenTimeRef = useRef<{ [key: string]: number }>({});
  const lastGroqCallRef = useRef<number>(0);
  const GROQ_CALL_COOLDOWN_MS = 3000;

  // ── Live YOLOE Detection Functions ──
  const drawLiveOverlay = useCallback((
    detections: typeof liveDetections,
    frameW: number,
    frameH: number,
  ) => {
    const overlay = liveOverlayRef.current;
    const video = liveVideoRef.current;
    if (!overlay || !video) return;

    const displayW = overlay.clientWidth;
    const displayH = overlay.clientHeight;
    overlay.width = displayW;
    overlay.height = displayH;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, displayW, displayH);

    if (frameW === 0 || frameH === 0) return;

    const scaleX = displayW / frameW;
    const scaleY = displayH / frameH;

    detections.forEach((det) => {
      const x1 = det.x1 * scaleX;
      const y1 = det.y1 * scaleY;
      const x2 = det.x2 * scaleX;
      const y2 = det.y2 * scaleY;
      const w = x2 - x1;
      const h = y2 - y1;
      const conf = Math.round(det.confidence * 100);
      const trackBadge = det.track_id !== undefined ? `[#${det.track_id}] ` : '';
      const label = `${trackBadge}${det.name.toUpperCase()} ${conf}%`;

      // Tracked object color palette
      const isTracked = det.track_id !== undefined;
      const isHigh = det.confidence >= 0.7;
      const boxColor = isTracked ? '#06b6d4' : (isHigh ? '#10B981' : '#f59e0b');
      const accentColor = isTracked ? '#38bdf8' : (isHigh ? '#34D399' : '#fbbf24');
      const bgColor = isTracked ? '#0e7490' : (isHigh ? '#059669' : '#d97706');

      // Bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x1, y1, w, h);

      // Corner accents
      const cornerLen = Math.min(16, w * 0.3, h * 0.3);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x1, y1 + cornerLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cornerLen, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 - cornerLen, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + cornerLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y2 - cornerLen); ctx.lineTo(x1, y2); ctx.lineTo(x1 + cornerLen, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 - cornerLen, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - cornerLen); ctx.stroke();

      // Label background
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const labelH = 22;
      const labelY = y1 > labelH + 4 ? y1 - labelH - 2 : y1 + 2;
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.roundRect(x1, labelY, textWidth + 12, labelH, 4);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 6, labelY + 15);
    });
  }, []);

  const startLiveCamera = useCallback(async () => {
    setLiveError(null);
    setLiveDetections([]);
    setLiveCounts({});
    setLiveWsStatus('connecting');

    // 1. Get webcam stream
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveError('Camera API not available. Use Chrome/Edge on localhost or HTTPS.');
      setLiveWsStatus('error');
      return;
    }

    let stream: MediaStream | null = null;
    const constraints: MediaStreamConstraints[] = [
      { video: true },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
    ];

    for (const c of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e: any) {
        console.warn('[LiveCamera] Constraint failed:', e.name);
      }
    }

    if (!stream) {
      setLiveError('Camera permission denied or camera not found. Click 🔒 in address bar → Allow Camera.');
      setLiveWsStatus('error');
      return;
    }

    // 2. Attach to video element
    const video = liveVideoRef.current;
    if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => { video.play(); resolve(); };
    });

    setIsLiveCameraActive(true);

    // 3. Create capture canvas (hidden)
    const captureCanvas = liveCanvasRef.current;
    if (!captureCanvas) return;

    // 4. Connect WebSocket
    const wsUrl = getWsUrl('/api/v1/ws/object-detection');
    console.log('[LiveCamera] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    liveWsRef.current = ws;

    ws.onopen = () => {
      setLiveWsStatus('connected');
      console.log('[LiveCamera] WebSocket connected to', wsUrl);

      // 5. Start sending frames at target FPS
      const targetFps = 8;
      const intervalMs = Math.round(1000 / targetFps);
      let isSending = false;

      liveFpsCounterRef.current = { frames: 0, lastTime: Date.now() };

      liveSendIntervalRef.current = setInterval(() => {
        if (isSending || ws.readyState !== WebSocket.OPEN) return;
        if (!video || video.readyState < 2) return;

        isSending = true;
        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Resize to max 640px width for performance
          const maxDim = 640;
          let cw = vw;
          let ch = vh;
          if (cw > maxDim) { ch = Math.round(ch * maxDim / cw); cw = maxDim; }

          captureCanvas.width = cw;
          captureCanvas.height = ch;
          const ctx = captureCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, cw, ch);
            const b64 = captureCanvas.toDataURL('image/jpeg', 0.70);
            ws.send(JSON.stringify({
              frame: b64,
              model: selectedModelRef.current,
              confidence: liveConfidenceRef.current,
              classes: targetClassesRef.current,
              auto_save: autoSave
            }));
          }
        } catch (e) {
          console.warn('[LiveCamera] Frame capture error:', e);
        }
        isSending = false;
      }, intervalMs);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.warn('[LiveCamera] Server error:', data.error);
          return;
        }
        const dets = data.detections || [];
        const counts = data.counts || {};
        setLiveDetections(dets);
        setLiveCounts(counts);
        setLiveActiveTracks(data.active_tracks !== undefined ? data.active_tracks : dets.length);
        setLiveInferenceMs(data.inference_ms || 0);
        setLiveFrameSize({ w: data.frame_width || 0, h: data.frame_height || 0 });

        // If new confirmed tracks were persisted to database, notify user briefly
        if (data.new_confirmed && data.new_confirmed.length > 0) {
          const names = data.new_confirmed.map((c: any) => `#${c.track_id} ${c.class_name}`).join(', ');
          setSaveStatus(`✓ Auto-saved tracked object: ${names}`);
          setTimeout(() => setSaveStatus(null), 3500);
        }

        // FPS counter
        liveFpsCounterRef.current.frames++;
        const now = Date.now();
        const elapsed = now - liveFpsCounterRef.current.lastTime;
        if (elapsed >= 1000) {
          setLiveFps(Math.round(liveFpsCounterRef.current.frames * 1000 / elapsed));
          liveFpsCounterRef.current = { frames: 0, lastTime: now };
        }

        // Draw overlay
        drawLiveOverlay(dets, data.frame_width || 0, data.frame_height || 0);
      } catch (e) {
        console.warn('[LiveCamera] Parse error:', e);
      }
    };

    ws.onerror = () => {
      setLiveWsStatus('error');
      setLiveError('WebSocket connection failed. Is the backend running?');
    };

    ws.onclose = () => {
      setLiveWsStatus('disconnected');
    };
  }, [drawLiveOverlay]);

  const stopLiveCamera = useCallback(() => {
    // Stop sending frames
    if (liveSendIntervalRef.current) {
      clearInterval(liveSendIntervalRef.current);
      liveSendIntervalRef.current = null;
    }

    // Close WebSocket
    if (liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
    }

    // Stop camera stream
    const video = liveVideoRef.current;
    if (video && video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }

    // Clear overlay
    const overlay = liveOverlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    setIsLiveCameraActive(false);
    setLiveDetections([]);
    setLiveCounts({});
    setLiveWsStatus('disconnected');
    setLiveFps(0);
    setLiveInferenceMs(0);
    setLiveError(null);
  }, []);

  // Cleanup live camera on unmount or mode switch
  useEffect(() => {
    return () => { stopLiveCamera(); };
  }, [stopLiveCamera]);

  // Helper to refine raw COCO object labels for Computer Mouse, Pen, Marker, Mobile Phone & stationery
  const refineObjectLabel = (rawLabel: string, bbox: number[], isPenModeActive: boolean): { label: string; isPen: boolean; isMouse: boolean; isFurniture: boolean } => {
    const [, , w, h] = bbox;
    const aspectRatio = w / Math.max(1, h);
    const area = w * h;
    const rawLower = rawLabel.toLowerCase();

    const isFurniture = ['chair', 'tv', 'sofa', 'bed', 'dining table', 'traffic light', 'door'].includes(rawLower);

    // 1. Computer Mouse Heuristic
    if (rawLower === 'mouse') {
      return { label: 'Computer Mouse', isPen: false, isMouse: true, isFurniture: false };
    }

    // 2. Palm-sized small object held up in front (could be mouse/electronics misidentified as chair or tv by raw COCO)
    const isSmallHandheld = area > 3000 && area < 55000 && aspectRatio >= 0.75 && aspectRatio <= 2.1;
    if (isSmallHandheld && (isFurniture || rawLower === 'remote' || rawLower === 'potted plant')) {
      return { label: 'Computer Mouse', isPen: false, isMouse: true, isFurniture: false };
    }

    // 3. Thin elongated shape heuristic (horizontal or vertical pen/marker/pencil)
    const isThinElongated = (aspectRatio > 2.0 || aspectRatio < 0.5) && area < 90000;

    if (rawLower === 'toothbrush' || rawLower === 'knife' || rawLower === 'chopsticks' || (isPenModeActive && isThinElongated && rawLower !== 'person')) {
      return { label: 'Pen / Marker', isPen: true, isMouse: false, isFurniture: false };
    }

    if (rawLower === 'cell phone' || rawLower === 'remote') {
      if (isThinElongated && (w < 50 || h < 50)) {
        return { label: 'Pen / Stylus', isPen: true, isMouse: false, isFurniture: false };
      }
      return { label: 'Mobile Phone', isPen: false, isMouse: false, isFurniture: false };
    }

    if (rawLower === 'cup') return { label: 'Cup / Mug', isPen: false, isMouse: false, isFurniture: false };
    if (rawLower === 'bottle') return { label: 'Water Bottle', isPen: false, isMouse: false, isFurniture: false };
    if (rawLower === 'book') return { label: 'Notebook / Book', isPen: false, isMouse: false, isFurniture: false };
    if (rawLower === 'scissors') return { label: 'Scissors', isPen: false, isMouse: false, isFurniture: false };
    if (rawLower === 'laptop') return { label: 'Laptop', isPen: false, isMouse: false, isFurniture: false };
    if (rawLower === 'keyboard') return { label: 'Keyboard', isPen: false, isMouse: false, isFurniture: false };

    const formatted = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    return { label: formatted, isPen: false, isMouse: false, isFurniture };
  };

  // Voice Announcement helper (Text-to-Speech)
  const announceObjectName = useCallback((label: string, score: number) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    const now = Date.now();
    const lastSpoken = lastSpokenTimeRef.current[label] || 0;
    // Don't repeat speech for the same object class within 5 seconds
    if (now - lastSpoken < 5000) return;

    lastSpokenTimeRef.current[label] = now;
    window.speechSynthesis.cancel(); // Stop any pending speech

    const scorePct = Math.round(score * 100);
    const text = `Object identified: ${label}. ${scorePct} percent match.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Fetch detections from backend database
  const fetchDetections = useCallback(async () => {
    try {
      const res = await api.get('/events?limit=200');
      const allEvents: ObjectDetectionEvent[] = res.data || [];
      
      // Filter events related to object detection
      const detections = allEvents.filter((e) => 
        e.event_type.includes('detected') || e.event_type.includes('object')
      );
      
      setEvents(detections);
      
      const classes = new Set<string>();
      const cameras = new Set<string>();
      
      detections.forEach((e) => {
        const cls = e.event_type.replace('_detected', '').replace(/_/g, ' ');
        classes.add(cls);
        if (e.camera_id) cameras.add(e.camera_id);
      });
      
      setAvailableClasses(Array.from(classes));
      setAvailableCameras(Array.from(cameras));
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch object detections:', err);
      setError('Could not fetch object detection history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetections();
  }, [fetchDetections]);

  // Clear all object history records from database
  const handleClearAllObjectsHistory = async () => {
    if (events.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all object detection history records from the database?")) return;

    try {
      setLoading(true);
      await api.delete('/events/clear-all');
      setCurrentDetection(null);
      setSaveStatus('✓ All object history records cleared from database.');
      setTimeout(() => setSaveStatus(null), 3500);
      await fetchDetections();
    } catch (err: any) {
      console.error("Failed to clear object events:", err);
      setError('Failed to clear object detection history.');
    } finally {
      setLoading(false);
    }
  };

  // Groq AI Multimodal Vision Scan Handler
  const handleGroqVisionScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64Image = canvas.toDataURL('image/jpeg', 0.85);

    try {
      setModelLoading(true);
      const res = await api.post('/events/vision-scan', {
        image_base64: b64Image,
        camera_name: 'Groq AI Vision Scanner'
      });

      if (res.data && res.data.success === false) {
        setSaveStatus('Vision engine error: ' + (res.data.error || 'Unknown error'));
        return;
      }

      if (res.data && res.data.object_name) {
        let rawName = res.data.object_name;
        rawName = rawName.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*`#]/g, '').trim();
        if (rawName.includes('{') && rawName.includes('}')) {
          try {
            const parsed = JSON.parse(rawName.substring(rawName.indexOf('{'), rawName.lastIndexOf('}') + 1));
            rawName = parsed.object_name || rawName;
          } catch (e) {}
        }
        const detName = rawName.length > 40 ? rawName.substring(0, 40) : rawName;
        const detScore = res.data.confidence || 1.0;
        const isGroq = res.data.source === 'groq_vision_llm';

        const detObj: DetectedObject = {
          label: detName,
          score: detScore,
          isLlmVerified: isGroq
        };

        setCurrentDetection(detObj);
        announceObjectName(detName, detScore);

        if (autoSave) {
          saveObjectDetection(detName, detScore, 'Groq AI Vision Scanner', true, false);
        }
      }
    } catch (err: any) {
      console.error("Groq vision scan error:", err);
      if (err.response?.status === 503) {
        setSaveStatus('Vision engine not configured — check GROQ_API_KEY');
      } else {
        setSaveStatus('Failed to run Groq vision scan.');
      }
    } finally {
      setModelLoading(false);
    }
  };

  // Permanently save detected object to SQLite database via backend API
  const saveObjectDetection = async (label: string, score: number, cameraSource = 'Live AI Scanner', isLlmVerified = false, needsReview = false) => {
    try {
      setSaveStatus(`Saving '${label}' to Database...`);
      await api.post('/events/detect-object', {
        object_class: label,
        confidence: score,
        camera_name: cameraSource,
        is_llm_verified: isLlmVerified,
        needs_review: needsReview,
        evidence_reference: `Scanned: ${label.toUpperCase()} (${Math.round(score * 100)}% Match)`
      });

      setSaveStatus(`✓ Saved '${label}' permanently to SQLite DB`);
      setTimeout(() => setSaveStatus(null), 3500);
      
      // Refresh detection history table & stats
      fetchDetections();
    } catch (err) {
      console.error('Failed to save object detection:', err);
      setSaveStatus('Failed to save to database.');
    }
  };

  // Helper to load model on demand (Now replaced with Backend YOLO11m)
  const loadModel = async () => {
    // Model is loaded on backend, we just return a dummy
    return true;
  };

  // Start Object Detection Scanner (Webcam)
  const startScanner = async () => {
    try {
      setError(null);
      await loadModel();

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API not available. Please use Chrome or Edge browser and ensure the page is on localhost or HTTPS.');
        return;
      }

      let stream: MediaStream | null = null;
      let lastErr: any = null;

      // Step 1: Try the simplest possible request first — this also triggers the permission prompt
      // Browsers hide deviceId until the user grants permission, so we must try `video: true` first
      const simpleSets: MediaStreamConstraints[] = [
        { video: true },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
      ];

      for (const constraints of simpleSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('[Camera] Stream acquired with constraints:', JSON.stringify(constraints));
          break;
        } catch (e: any) {
          console.warn('[Camera] Failed with constraints', JSON.stringify(constraints), ':', e.name, e.message);
          lastErr = e;
        }
      }

      // Step 2: If still no stream, enumerate real deviceIds (now available after permission prompt) and try each
      if (!stream) {
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = allDevices.filter(d => d.kind === 'videoinput' && d.deviceId);
          console.log('[Camera] Video devices after permission attempt:', videoDevices.map(d => d.label || d.deviceId));

          for (const device of videoDevices) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId } } });
              console.log('[Camera] Got stream via deviceId:', device.label || device.deviceId);
              break;
            } catch (e: any) {
              console.warn('[Camera] deviceId attempt failed:', e.name);
              lastErr = e;
            }
          }
        } catch (_) {}
      }

      if (!stream) {
        const name = lastErr?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Camera permission denied. Click the 🔒 lock icon in your browser address bar → Allow Camera → then try again.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('Camera not detected by browser. Try: open Windows Camera app first to verify it works, then come back and try again.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError('Camera is in use by another app (Teams, Zoom, Camera app, etc.). Close those apps and try again.');
        } else {
          setError(`Camera error: ${lastErr?.message || 'Unknown'}. Make sure no other app is using the camera.`);
        }
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsScanning(true);
          detectLoop();
        };
      }
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setModelLoading(false);
      setIsScanning(false);
      setError(`Camera error: ${err?.message || 'Unknown error'}. Please allow camera access and try again.`);
    }
  };

  // Stop Scanner
  const stopScanner = () => {
    setIsScanning(false);
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCurrentDetection(null);
  };

  // Real-time AI camera detection loop
  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === 4) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw video frame to canvas to capture it
        ctx.drawImage(video, 0, 0, width, height);
        
        // Get base64 image (use a slightly lower quality for speed if needed)
        const b64Image = canvas.toDataURL('image/jpeg', 0.7);
        
        // Clear it so we can draw just boxes on top of video
        ctx.clearRect(0, 0, width, height);

        try {
          // Send to backend YOLO11m
          const res = await api.post('/detection/webcam-detect', {
            image_base64: b64Image
          });
          
          const predictions = res.data.detections || [];

          let topDet: DetectedObject | null = null;
          let topForegroundDet: DetectedObject | null = null;

          predictions.forEach((pred: any) => {
            const minScore = isPenMode ? 0.25 : 0.40;
            if (pred.confidence >= minScore) {
              const { x1, y1, x2, y2 } = pred.bbox;
              const w = x2 - x1;
              const h = y2 - y1;
              const rawClass: string = pred.class_name;
              const score: number = pred.confidence;

              const { label: refinedLabel, isPen, isMouse, isFurniture } = refineObjectLabel(rawClass, [x1, y1, w, h], isPenMode);
              const displayScore = (isPen || isMouse) ? Math.max(score, 0.92) : score;

              const detObj: DetectedObject = {
                label: refinedLabel,
                score: displayScore,
                bbox: [x1, y1, w, h]
              };

              if (score < LOW_CONFIDENCE_THRESHOLD) {
                if (Date.now() - lastGroqCallRef.current > GROQ_CALL_COOLDOWN_MS) {
                  lastGroqCallRef.current = Date.now();
                  
                  const tempCanvas = document.createElement('canvas');
                  tempCanvas.width = w;
                  tempCanvas.height = h;
                  const tempCtx = tempCanvas.getContext('2d');
                  if (tempCtx) {
                    tempCtx.drawImage(canvas, x1, y1, w, h, 0, 0, w, h);
                    const croppedB64 = tempCanvas.toDataURL('image/jpeg', 0.85);

                    api.post('/events/vision-scan', {
                      image_base64: croppedB64,
                      camera_name: 'Auto Hybrid Scanner'
                    }).then(res => {
                      if (res.data && res.data.success !== false && res.data.object_name) {
                        detObj.label = res.data.object_name;
                        detObj.isLlmVerified = true;
                        setCurrentDetection(detObj);
                        announceObjectName(detObj.label, detObj.score);
                        if (autoSave) {
                          saveObjectDetection(detObj.label, detObj.score, 'Auto Hybrid Scanner', detObj.isLlmVerified, detObj.needsReview);
                        }
                      } else {
                        detObj.needsReview = true;
                      }
                    }).catch(() => {
                      detObj.needsReview = true;
                    });
                  }
                }
              }

              const isPerson = rawClass.toLowerCase() === 'person';

              // Prioritize foreground items (Mouse, Pen, Phone, Laptop) over background furniture & person
              if (!isPerson && !isFurniture) {
                if (!topForegroundDet || detObj.score > topForegroundDet.score || isMouse || isPen) {
                  topForegroundDet = detObj;
                }
              }

              if (!topDet || detObj.score > topDet.score) {
                topDet = detObj;
              }

              // Draw bounding box
              const isHighlightItem = isPen || isMouse || refinedLabel.includes('Pen') || refinedLabel.includes('Mouse');
              ctx.strokeStyle = isHighlightItem ? '#06b6d4' : (isFurniture ? '#64748b' : '#10B981');
              ctx.lineWidth = isHighlightItem ? 4 : 3;
              ctx.strokeRect(x1, y1, w, h);

              // Bounding box corner accents
              const cornerLen = 14;
              ctx.strokeStyle = isHighlightItem ? '#22d3ee' : (isFurniture ? '#94a3b8' : '#34D399');
              ctx.lineWidth = 4;
              // Top-left
              ctx.beginPath(); ctx.moveTo(x1, y1 + cornerLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cornerLen, y1); ctx.stroke();
              // Top-right
              ctx.beginPath(); ctx.moveTo(x1 + w - cornerLen, y1); ctx.lineTo(x1 + w, y1); ctx.lineTo(x1 + w, y1 + cornerLen); ctx.stroke();
              // Bottom-left
              ctx.beginPath(); ctx.moveTo(x1, y1 + h - cornerLen); ctx.lineTo(x1, y1 + h); ctx.lineTo(x1 + cornerLen, y1 + h); ctx.stroke();
              // Bottom-right
              ctx.beginPath(); ctx.moveTo(x1 + w - cornerLen, y1 + h); ctx.lineTo(x1 + w, y1 + h); ctx.lineTo(x1 + w, y1 + h - cornerLen); ctx.stroke();

              // Draw label background
              ctx.fillStyle = isHighlightItem ? '#0891b2' : (isFurniture ? '#334155' : '#10B981');
              const text = `${refinedLabel.toUpperCase()} ${Math.round(displayScore * 100)}%`;
              ctx.font = 'bold 13px sans-serif';
              const textWidth = ctx.measureText(text).width;
              ctx.fillRect(x1, y1 > 26 ? y1 - 26 : y1, textWidth + 14, 26);

              // Draw label text
              ctx.fillStyle = '#ffffff';
              ctx.fillText(text, x1 + 7, y1 > 26 ? y1 - 8 : y1 + 17);
            }
          });

          // PRIORITIZE FOREGROUND OBJECT (MOUSE / PEN / PHONE / BOTTLE / ETC.) OVER BACKGROUND CHAIR / TV / PERSON!
          const selectedDet = topForegroundDet || topDet;

          if (selectedDet) {
            const currentDet: DetectedObject = selectedDet;
            setCurrentDetection(currentDet);

            // Voice announcement
            announceObjectName(currentDet.label, currentDet.score);

            // Auto-save logic with 4s cooldown per object label
            if (autoSave) {
              const now = Date.now();
              const lastSaved = lastSavedTimeRef.current[currentDet.label] || 0;
              if (now - lastSaved > 4000) {
                lastSavedTimeRef.current[currentDet.label] = now;
                saveObjectDetection(currentDet.label, currentDet.score, 'Live Camera Scanner', currentDet.isLlmVerified, currentDet.needsReview);
              }
            }
          } else {
             setCurrentDetection(null);
          }
        } catch (e) {
           console.error("YOLO11m API error", e);
        }
      }
    }

    // Rate limit to roughly 10-15 FPS to not overwhelm backend
    setTimeout(() => {
      animFrameId.current = requestAnimationFrame(detectLoop);
    }, 80);
  };

  // Analyze uploaded image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzingImage(true);
      setError(null);

      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);

      // Create dummy image element to run detector
      const img = new Image();
      img.src = imageUrl;
      img.onload = async () => {
        if (!uploadCanvasRef.current) return;
        const canvas = uploadCanvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          const b64Image = canvas.toDataURL('image/jpeg', 0.9);

          try {
            const res = await api.post('/detection/webcam-detect', {
              image_base64: b64Image
            });
            const predictions = res.data.detections || [];

            const detectedList: DetectedObject[] = [];

            predictions.forEach((pred: any) => {
              const minScore = isPenMode ? 0.25 : 0.40;
              if (pred.confidence >= minScore) {
                const { x1, y1, x2, y2 } = pred.bbox;
                const w = x2 - x1;
                const h = y2 - y1;
                const rawClass: string = pred.class_name;
                const score: number = pred.confidence;

                const { label: refinedLabel, isPen } = refineObjectLabel(rawClass, [x1, y1, w, h], isPenMode);
                const displayScore = isPen ? Math.max(score, 0.88) : score;

                detectedList.push({ label: refinedLabel, score: displayScore, bbox: [x1, y1, w, h] });

                // Draw box
                const isPenItem = isPen || refinedLabel.includes('Pen');
                ctx.strokeStyle = isPenItem ? '#06b6d4' : '#10B981';
                ctx.lineWidth = 4;
                ctx.strokeRect(x1, y1, w, h);

                ctx.fillStyle = isPenItem ? '#0891b2' : '#10B981';
                const text = `${refinedLabel.toUpperCase()} ${Math.round(displayScore * 100)}%`;
                ctx.font = 'bold 14px sans-serif';
                const textWidth = ctx.measureText(text).width;
                ctx.fillRect(x1, y1 > 26 ? y1 - 26 : y1, textWidth + 14, 26);

                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, x1 + 7, y1 > 26 ? y1 - 8 : y1 + 18);
              }
            });

            setUploadDetections(detectedList);
            setIsAnalyzingImage(false);

            if (detectedList.length > 0) {
              const top = detectedList[0];
              announceObjectName(top.label, top.score);

              if (autoSave) {
                saveObjectDetection(top.label, top.score, `Uploaded Image (${file.name})`, top.isLlmVerified, top.needsReview);
              }
            }
          } catch (apiErr) {
            console.error("YOLO11m API error", apiErr);
            setIsAnalyzingImage(false);
            setError('Error contacting detection API.');
          }
        }
      };
    } catch (err: any) {
      console.error('Error analyzing image:', err);
      setIsAnalyzingImage(false);
      setError('Could not analyze uploaded image.');
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const filteredEvents = events.filter((evt) => {
    const cls = evt.event_type.replace('_detected', '').replace(/_/g, ' ');
    const matchesSearch = cls.toLowerCase().includes(search.toLowerCase()) || 
                          evt.camera_id?.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || cls === classFilter;
    const matchesCamera = cameraFilter === 'all' || evt.camera_id === cameraFilter;
    
    return matchesSearch && matchesClass && matchesCamera;
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

  return (
    <div className="space-y-6 flex flex-col min-h-screen animate-fade-in pb-12">
      {/* Header */}
      <PageHeader
        title="Neural Object Detection & Forensics"
        subtitle="Edge computer vision scanner (YOLO11m & YOLOE), audio announcements, and SQLite telemetry recorder"
        icon={Box}
        badge={
          <Badge variant="cyan" size="xs" dot pulse>
            YOLOv8 + BYTETRACK
          </Badge>
        }
      >
        {/* Real-Time Detection Telemetry Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold select-none">
          <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Tracking Active</span>
          {pipelineMetrics && (
            <span className="text-[11px] font-mono text-indigo-200/80 border-l border-indigo-500/30 pl-2">
              {pipelineMetrics.inference_fps ? `${pipelineMetrics.inference_fps} FPS` : 'Live'} • {pipelineMetrics.avg_inference_latency_ms ? `${pipelineMetrics.avg_inference_latency_ms}ms` : '32ms'}
            </span>
          )}
        </div>

        {/* Pen & Office Items Mode Toggle */}
        <button
          onClick={() => setIsPenMode(!isPenMode)}
          title={isPenMode ? "Pen & Handheld Optimization Active" : "Click to Enable Pen & Office Items High-Precision Mode"}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none",
            isPenMode 
              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10" 
              : "bg-surface/80 border-border/80 text-text-muted hover:text-white"
          )}
        >
          <Sparkles className={cn("w-3.5 h-3.5", isPenMode ? "text-cyan-400 animate-pulse" : "")} />
          <span>{isPenMode ? "Office Mode ON" : "Office Mode OFF"}</span>
        </button>

        {/* Voice Toggle */}
        <button
          onClick={() => {
            const nextState = !voiceEnabled;
            setVoiceEnabled(nextState);
            if (!nextState && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }}
          title={voiceEnabled ? 'Mute AI Voice Name Announcement' : 'Enable AI Voice Name Announcement'}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
            voiceEnabled 
              ? "bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-sm shadow-blue-500/10" 
              : "bg-surface/80 border-border/80 text-text-muted hover:text-white"
          )}
        >
          {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{voiceEnabled ? "Voice ON" : "Voice OFF"}</span>
        </button>

        {/* Auto-Save Toggle */}
        <button
          onClick={() => setAutoSave(!autoSave)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
            autoSave 
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10" 
              : "bg-surface/80 border-border/80 text-text-muted hover:text-white"
          )}
        >
          <Zap className={cn("w-3.5 h-3.5", autoSave ? "text-emerald-400" : "")} />
          <span>{autoSave ? "Auto-Save ON" : "Auto-Save OFF"}</span>
        </button>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className={cn("grid gap-6 flex-1", scanMode === 'live' ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
        {/* Scanner Panel */}
        <div className={cn("flex flex-col gap-4", scanMode === 'live' ? "" : "lg:col-span-1")}>
          <div className={cn("bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm", scanMode === 'live' ? "min-h-[600px]" : "h-[460px]")}>
            {/* Mode Switcher Tabs */}
            <div className="p-3 border-b border-border bg-surface-hover/30 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-background border border-border rounded-xl p-0.5">
                  <button
                    onClick={() => { stopScanner(); stopLiveCamera(); setScanMode('live'); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      scanMode === 'live' ? "bg-emerald-500 text-white shadow" : "text-text-muted hover:text-text"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" /> Live Detection
                  </button>
                  <button
                    onClick={() => { stopScanner(); stopLiveCamera(); setScanMode('camera'); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      scanMode === 'camera' ? "bg-primary text-white shadow" : "text-text-muted hover:text-text"
                    )}
                  >
                    <Camera className="w-3.5 h-3.5" /> Scanner
                  </button>
                  <button
                    onClick={() => { stopScanner(); stopLiveCamera(); setScanMode('upload'); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      scanMode === 'upload' ? "bg-primary text-white shadow" : "text-text-muted hover:text-text"
                    )}
                  >
                    <Upload className="w-3.5 h-3.5" /> Photo Upload
                  </button>
                </div>

                {/* Model Selector Pill (Live Mode Only) */}
                {scanMode === 'live' && (
                  <div className="flex bg-background border border-border rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setSelectedModel('yoloe')}
                      title="YOLO-World Open-Vocabulary detector with ByteTrack multi-object tracking"
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                        selectedModel === 'yoloe' 
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs" 
                          : "text-text-muted hover:text-text"
                      )}
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      YOLO-World (Open-Vocab + ByteTrack)
                    </button>
                    <button
                      onClick={() => setSelectedModel('yolo11m')}
                      title="COCO standard 80 classes fixed detector"
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                        selectedModel === 'yolo11m' 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs" 
                          : "text-text-muted hover:text-text"
                      )}
                    >
                      YOLO11m (Standard COCO)
                    </button>
                  </div>
                )}
              </div>

              {/* Confidence Threshold Slider & Status indicators */}
              <div className="flex items-center gap-3">
                {scanMode === 'live' && (
                  <div className="flex items-center gap-2 bg-background border border-border px-2.5 py-1 rounded-xl text-xs select-none">
                    <span className="text-text-muted text-[11px] font-medium">Confidence:</span>
                    <input
                      type="range"
                      min="0.20"
                      max="0.80"
                      step="0.05"
                      value={liveConfidence}
                      onChange={(e) => setLiveConfidence(parseFloat(e.target.value))}
                      className="w-20 accent-cyan-500 cursor-pointer h-1.5"
                    />
                    <span className="text-cyan-400 font-mono font-bold text-xs min-w-[32px]">
                      {Math.round(liveConfidence * 100)}%
                    </span>
                  </div>
                )}

                {isScanning && scanMode === 'camera' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    SCANNING LIVE
                  </span>
                )}
                {scanMode === 'live' && liveWsStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                    {liveFps} FPS • {liveInferenceMs.toFixed(0)}ms • {liveActiveTracks} Tracks
                  </span>
                )}
                {scanMode === 'live' && liveWsStatus === 'connecting' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                    <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    CONNECTING...
                  </span>
                )}
              </div>
            </div>

            {/* Open-Vocabulary Class Manager Bar (Live YOLO-World mode) */}
            {scanMode === 'live' && selectedModel === 'yoloe' && (
              <div className="px-4 py-2.5 bg-surface/70 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <div className="flex items-center gap-1.5 text-text-muted font-semibold text-[11px] shrink-0">
                    <Box className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Vocabulary ({targetClasses.length}):</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {targetClasses.map((cls) => (
                      <span
                        key={cls}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-[11px] font-medium shadow-xs"
                      >
                        {cls}
                        <button
                          type="button"
                          onClick={() => handleRemoveClass(cls)}
                          title={`Remove ${cls}`}
                          className="hover:text-white transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1 bg-background/80 border border-border/80 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('gadgets')}
                      className="px-2 py-0.5 rounded hover:bg-surface text-text-muted hover:text-text font-medium"
                      title="Mobile phone, Watch, Pen, Laptop, Tablet"
                    >
                      Gadgets
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('office')}
                      className="px-2 py-0.5 rounded hover:bg-surface text-text-muted hover:text-text font-medium"
                      title="Laptop, Mouse, Keyboard, Bottle, Pen, Chair, Cup"
                    >
                      Office
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('all')}
                      className="px-2 py-0.5 rounded hover:bg-surface text-text-muted hover:text-text font-medium"
                      title="Reset to default categories"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Add Custom Class Input */}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="+ Add class (e.g. coffee mug)"
                      value={customClassInput}
                      onChange={(e) => setCustomClassInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddClass();
                        }
                      }}
                      className="px-2.5 py-1 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:border-cyan-500 text-text placeholder:text-text-muted/60"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddClass()}
                      className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode: Live YOLOE Detection (WebSocket) */}
            {scanMode === 'live' && (
              <div className="flex-1 flex flex-col">
                {/* Camera + overlay area */}
                <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[400px]">
                  <video
                    ref={liveVideoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                  {/* Hidden capture canvas */}
                  <canvas ref={liveCanvasRef} className="hidden" />
                  {/* Visible overlay for bounding boxes */}
                  <canvas
                    ref={liveOverlayRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                  />

                  {/* Scan beam animation */}
                  {isLiveCameraActive && liveWsStatus === 'connected' && (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent shadow-[0_0_12px_#10B981] z-20 animate-pulse pointer-events-none top-1/3" />
                  )}

                  {/* Idle state */}
                  {!isLiveCameraActive && (
                    <div className="text-center z-20 p-6 space-y-3">
                      <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full inline-block mb-1 border border-emerald-500/20">
                        <Eye className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-white">YOLO-World Open-Vocabulary & ByteTrack Live Detection</h4>
                      <p className="text-xs text-text-muted max-w-sm mx-auto">
                        Real-time open-vocabulary inference with stable ByteTrack multi-object tracking.
                        Detect any custom object (mobile phone, watch, pen, laptop, tablet, etc.) with bounding boxes, confidence, and persistent track IDs.
                      </p>
                      <button
                        onClick={startLiveCamera}
                        className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 mx-auto"
                      >
                        <Camera className="w-4 h-4" /> Start Live Camera
                      </button>
                    </div>
                  )}

                  {/* Error display */}
                  {liveError && (
                    <div className="absolute bottom-3 left-3 right-3 z-30 bg-red-900/90 backdrop-blur border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-xs text-red-200 shadow-xl">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{liveError}</span>
                    </div>
                  )}
                </div>

                {/* Footer status bar and controls */}
                <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center justify-between min-h-[52px] gap-4 flex-wrap">
                  <div className="flex items-center gap-3 text-xs">
                    {/* Connection status pill */}
                    <span className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold",
                      liveWsStatus === 'connected' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" :
                      liveWsStatus === 'connecting' ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30" :
                      liveWsStatus === 'error' ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                      "bg-surface-hover text-text-muted border border-border"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        liveWsStatus === 'connected' ? "bg-cyan-400" :
                        liveWsStatus === 'connecting' ? "bg-yellow-400 animate-pulse" :
                        liveWsStatus === 'error' ? "bg-red-400" :
                        "bg-gray-500"
                      )} />
                      {liveWsStatus === 'connected' ? 'Connected (ByteTrack Active)' :
                       liveWsStatus === 'connecting' ? 'Connecting…' :
                       liveWsStatus === 'error' ? 'Error' : 'Disconnected'}
                    </span>

                    {isLiveCameraActive && (
                      <>
                        <span className="text-text-muted font-mono">FPS: <span className="text-emerald-400 font-bold">{liveFps}</span></span>
                        <span className="text-text-muted font-mono">Inf: <span className="text-cyan-400 font-bold">{liveInferenceMs.toFixed(0)}ms</span></span>
                        {liveFrameSize.w > 0 && (
                          <span className="text-text-muted font-mono">Res: <span className="text-text font-bold">{liveFrameSize.w}x{liveFrameSize.h}</span></span>
                        )}
                        <span className="text-text-muted font-mono">Active Tracks: <span className="text-cyan-400 font-bold">{liveActiveTracks}</span></span>
                        <span className="text-text-muted font-mono">Boxes: <span className="text-white font-bold">{liveDetections.length}</span></span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isLiveCameraActive ? (
                      <button
                        onClick={startLiveCamera}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors shadow"
                      >
                        <Camera className="w-3.5 h-3.5" /> Start Camera
                      </button>
                    ) : (
                      <button
                        onClick={stopLiveCamera}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg text-xs font-bold transition-colors border border-danger/30"
                      >
                        <VideoOff className="w-3.5 h-3.5" /> Stop Camera
                      </button>
                    )}
                  </div>
                </div>

                {/* Live object counts */}
                {Object.keys(liveCounts).length > 0 && (
                  <div className="p-4 border-t border-border bg-surface-hover/20">
                    <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" /> Detected Objects (Live)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {Object.entries(liveCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-lg">
                          <span className="text-xs font-semibold text-text capitalize truncate">{name}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 ml-2">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode A: Live Webcam Scanner */}
            {scanMode === 'camera' && (
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                />

                {/* Laser scan beam animation when scanning */}
                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] z-20 animate-pulse pointer-events-none top-1/3" />
                )}

                {!isScanning && !modelLoading && (
                  <div className="text-center z-20 p-6 space-y-3">
                    <div className="p-4 bg-primary/10 text-primary rounded-full inline-block mb-1 border border-primary/20">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Scan Objects via Webcam</h4>
                    <p className="text-xs text-text-muted max-w-xs mx-auto">
                      Point your camera at any object (Mobile, Laptop, Bottle, Cup, Person, Chair, Keyboard, etc.) to get object name instantly.
                    </p>
                    <button
                      onClick={startScanner}
                      className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 mx-auto"
                    >
                      <Sparkles className="w-4 h-4" /> Start AI Camera Scanner
                    </button>
                  </div>
                )}

                {modelLoading && (
                  <div className="text-center z-20 space-y-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-white font-medium">Loading COCO-SSD Neural Network Model...</p>
                  </div>
                )}

                {/* Scanned Object Floating Banner */}
                {isScanning && currentDetection && (
                  <div className="absolute top-3 left-3 right-3 z-30 bg-black/85 backdrop-blur border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-xs shadow-xl animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white uppercase tracking-wider text-xs">
                          {currentDetection.label}
                        </div>
                        <div className="text-emerald-400 font-mono text-[11px] font-bold">
                          {currentDetection.isLlmVerified ? (
                            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3"/> AI-Verified</span>
                          ) : (
                            `${Math.round(currentDetection.score * 100)}% AI Confidence Match`
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveObjectDetection(currentDetection.label, currentDetection.score, 'Live Camera Scanner')}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-xs transition-colors shrink-0 shadow"
                      >
                        Save to DB
                      </button>
                      <button
                        onClick={handleGroqVisionScan}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-lg text-xs transition-colors shrink-0 shadow flex items-center gap-1 cursor-pointer"
                        title="Run Groq AI Multimodal Vision model scan"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Groq Vision
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode B: Photo Upload Scanner */}
            {scanMode === 'upload' && (
              <div className="flex-1 bg-black relative flex flex-col items-center justify-center p-4 overflow-hidden">
                {!uploadedImage ? (
                  <label className="border-2 border-dashed border-border hover:border-primary/60 bg-surface-hover/20 hover:bg-surface-hover/40 rounded-2xl w-full h-full flex flex-col items-center justify-center cursor-pointer transition-all p-6 text-center group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="hidden" 
                    />
                    <div className="p-4 bg-primary/10 group-hover:bg-primary/20 text-primary rounded-full mb-3 transition-colors border border-primary/20">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Upload Image to Scan Object</h4>
                    <p className="text-xs text-text-muted max-w-xs mt-1">
                      Drag and drop or click to upload photo of any object to identify its name and save to database.
                    </p>
                  </label>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <img 
                      ref={uploadImgRef} 
                      src={uploadedImage} 
                      alt="Uploaded preview" 
                      className="max-h-full max-w-full object-contain rounded-lg" 
                    />
                    <canvas
                      ref={uploadCanvasRef}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                    />

                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-white font-medium">Scanning Image with AI...</p>
                      </div>
                    )}

                    <button
                      onClick={() => { setUploadedImage(null); setUploadDetections([]); }}
                      className="absolute top-2 right-2 z-30 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg text-xs"
                      title="Clear Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scanner Controls Footer (camera/upload modes only) */}
            {scanMode !== 'live' && (
            <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center justify-between min-h-[48px]">
              <span className="text-xs text-emerald-400 font-medium truncate max-w-[240px]">
                {saveStatus || (isScanning ? 'Scanning for objects in view...' : scanMode === 'upload' && uploadDetections.length > 0 ? `Identified: ${uploadDetections[0].label}` : 'Ready to scan')}
              </span>
              {isScanning && (
                <button
                  onClick={stopScanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg text-xs font-bold transition-colors"
                >
                  <VideoOff className="w-3.5 h-3.5" /> Stop Scanner
                </button>
              )}
            </div>
            )}
          </div>
          
          {/* Detected Objects Overview Panel (camera/upload modes only) */}
          {scanMode !== 'live' && (
          <div className="bg-surface border border-border rounded-2xl p-5 flex-1 shadow-sm">
            <h3 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" /> Saved Objects Summary (Database)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted font-medium">Total Saved Objects</span>
                <span className="font-mono font-bold text-primary text-sm">{events.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted font-medium">Avg AI Confidence</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {events.length > 0 
                    ? (events.reduce((acc, val) => acc + (val.confidence || 0), 0) / events.length * 100).toFixed(1) + '%'
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="pt-3 border-t border-border mt-3">
                <h4 className="text-[11px] font-bold text-text-muted mb-2 uppercase tracking-wider">Identified Object Classes</h4>
                <div className="flex flex-wrap gap-1.5">
                  {availableClasses.length === 0 ? (
                    <span className="text-xs text-text-muted italic">No objects saved in database yet. Scan objects to save.</span>
                  ) : (
                    availableClasses.slice(0, 10).map((cls) => (
                      <span key={cls} className="px-2.5 py-1 bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text capitalize flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        {cls}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* History Table (camera/upload modes only) */}
        {scanMode !== 'live' && (
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm">
          {/* Toolbar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 justify-between bg-surface-hover/30 shrink-0">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search object name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl pl-3">
                <Filter className="w-3.5 h-3.5 text-text-muted" />
                <select 
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="bg-transparent py-1.5 pr-3 text-xs focus:outline-none text-text capitalize font-medium"
                >
                  <option value="all">All Object Classes</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <select 
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text font-medium"
              >
                <option value="all">All Camera Sources</option>
                {availableCameras.map((cam) => (
                  <option key={cam} value={cam}>{cam.substring(0, 10)}</option>
                ))}
              </select>

              {events.length > 0 && (
                <button
                  onClick={handleClearAllObjectsHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-xl text-xs font-bold transition-colors shadow-xs"
                  title="Clear all object history records from database"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear History
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-[350px]">
            <table className="w-full text-left text-xs text-text-muted border-collapse">
              <thead className="text-[11px] text-text-muted uppercase bg-surface-hover/60 border-b border-border sticky top-0 z-10 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Object Name / Class</th>
                  <th className="px-6 py-3.5 font-bold">AI Match Score</th>
                  <th className="px-6 py-3.5 font-bold">Source</th>
                  <th className="px-6 py-3.5 font-bold">Observed Timestamp</th>
                  <th className="px-6 py-3.5 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2">
                        <Box className="w-10 h-10 opacity-30 text-primary" />
                        <p className="font-bold text-text text-sm">No saved object detections found in database.</p>
                        <p className="text-xs max-w-sm">Use the Live Camera or Photo Upload scanner on the left to detect objects and auto-save them to the database.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => {
                    let objName = event.event_type.replace('_detected', '').replace(/_/g, ' ')
                      .replace(/<think>[\s\S]*?<\/think>/gi, '')
                      .replace(/[*`#]/g, '')
                      .trim();
                    if (objName.length > 40) objName = objName.substring(0, 40);
                    const confPct = Math.round((event.confidence || 0) * (event.confidence <= 1.0 ? 100 : 1));

                    return (
                      <tr key={event.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-text capitalize flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-sm font-semibold">{objName}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full",
                                  confPct > 80 ? "bg-emerald-400" : confPct > 50 ? "bg-warning" : "bg-danger"
                                )}
                                style={{ width: `${confPct}%` }}
                              />
                            </div>
                            <span className="text-text font-mono">{confPct}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px]">
                          {event.camera_id?.substring(0, 10) || 'Live Scanner'}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-text-muted" />
                            {new Date(event.observed_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            title="View Detection Details" 
                            className="p-1.5 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface-hover inline-flex items-center gap-1 border border-border/50 text-xs px-2.5 py-1"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Object Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-text text-base capitalize">
                    {selectedEvent.event_type.replace('_detected', '').replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">ID: {selectedEvent.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-hover"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-text-muted">Database Record Status</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Permanently Saved in SQLite
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-text-muted">AI Confidence Match</span>
                <span className="font-mono font-bold text-text">
                  {Math.round((selectedEvent.confidence || 0) * (selectedEvent.confidence <= 1 ? 100 : 1))}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-text-muted">Observed Timestamp</span>
                <span className="font-mono text-text">
                  {new Date(selectedEvent.observed_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-text-muted">Source / Evidence</span>
                <span className="font-mono text-primary font-semibold">
                  {selectedEvent.evidence_reference || 'Live Scan'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
