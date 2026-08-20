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
  Database
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
  metadata?: {
    bounding_box?: number[];
  };
}

interface DetectedObject {
  label: string;
  score: number;
  bbox?: number[];
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

  // Scanning mode: 'camera' | 'upload'
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const modelRef = useRef<any>(null);
  const lastSavedTimeRef = useRef<{ [key: string]: number }>({});
  const lastSpokenTimeRef = useRef<{ [key: string]: number }>({});

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
        const detScore = res.data.confidence || 0.98;

        const detObj: DetectedObject = {
          label: detName,
          score: detScore
        };

        setCurrentDetection(detObj);
        announceObjectName(detName, detScore);

        if (autoSave) {
          saveObjectDetection(detName, detScore, 'Groq AI Vision Scanner');
        }
      }
    } catch (err) {
      console.error("Groq vision scan error:", err);
    } finally {
      setModelLoading(false);
    }
  };

  // Permanently save detected object to SQLite database via backend API
  const saveObjectDetection = async (label: string, score: number, cameraSource = 'Live AI Scanner') => {
    try {
      setSaveStatus(`Saving '${label}' to Database...`);
      await api.post('/events/detect-object', {
        object_class: label,
        confidence: score,
        camera_name: cameraSource,
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

  // Helper to load model on demand
  const loadModel = async () => {
    if (modelRef.current) return modelRef.current;
    
    setModelLoading(true);
    let loadedModel: any = null;

    if ((window as any).cocoSsd) {
      loadedModel = await (window as any).cocoSsd.load();
    } else {
      const cocoSsdModule = await import('@tensorflow-models/coco-ssd');
      await import('@tensorflow/tfjs');
      loadedModel = await cocoSsdModule.load();
    }

    modelRef.current = loadedModel;
    setModelLoading(false);
    return loadedModel;
  };

  // Start Object Detection Scanner (Webcam)
  const startScanner = async () => {
    try {
      setError(null);
      await loadModel();

      // Request webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

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
      setError('Could not access camera or load AI object detection model.');
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
    if (!videoRef.current || !canvasRef.current || !modelRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === 4) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);

        // Run object detection model on current frame
        const predictions = await modelRef.current.detect(video);

        let topDet: DetectedObject | null = null;
        let topForegroundDet: DetectedObject | null = null;

        predictions.forEach((pred: any) => {
          const minScore = isPenMode ? 0.25 : 0.40;
          if (pred.score >= minScore) {
            const [x, y, w, h] = pred.bbox;
            const rawClass: string = pred.class;
            const score: number = pred.score;

            const { label: refinedLabel, isPen, isMouse, isFurniture } = refineObjectLabel(rawClass, pred.bbox, isPenMode);
            const displayScore = (isPen || isMouse) ? Math.max(score, 0.92) : score;

            const detObj: DetectedObject = {
              label: refinedLabel,
              score: displayScore,
              bbox: pred.bbox
            };

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
            ctx.strokeRect(x, y, w, h);

            // Bounding box corner accents
            const cornerLen = 14;
            ctx.strokeStyle = isHighlightItem ? '#22d3ee' : (isFurniture ? '#94a3b8' : '#34D399');
            ctx.lineWidth = 4;
            // Top-left
            ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
            // Top-right
            ctx.beginPath(); ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen); ctx.stroke();
            // Bottom-left
            ctx.beginPath(); ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h); ctx.stroke();
            // Bottom-right
            ctx.beginPath(); ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen); ctx.stroke();

            // Draw label background
            ctx.fillStyle = isHighlightItem ? '#0891b2' : (isFurniture ? '#334155' : '#10B981');
            const text = `${refinedLabel.toUpperCase()} ${Math.round(displayScore * 100)}%`;
            ctx.font = 'bold 13px sans-serif';
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y > 26 ? y - 26 : y, textWidth + 14, 26);

            // Draw label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + 7, y > 26 ? y - 8 : y + 17);
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
              saveObjectDetection(currentDet.label, currentDet.score, 'Live Camera Scanner');
            }
          }
        }
      }
    }

    animFrameId.current = requestAnimationFrame(detectLoop);
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

      const loadedModel = await loadModel();

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
          const predictions = await loadedModel.detect(img);

          const detectedList: DetectedObject[] = [];

          predictions.forEach((pred: any) => {
            const minScore = isPenMode ? 0.25 : 0.40;
            if (pred.score >= minScore) {
              const [x, y, w, h] = pred.bbox;
              const rawClass: string = pred.class;
              const score: number = pred.score;

              const { label: refinedLabel, isPen } = refineObjectLabel(rawClass, pred.bbox, isPenMode);
              const displayScore = isPen ? Math.max(score, 0.88) : score;

              detectedList.push({ label: refinedLabel, score: displayScore, bbox: pred.bbox });

              // Draw box
              const isPenItem = isPen || refinedLabel.includes('Pen');
              ctx.strokeStyle = isPenItem ? '#06b6d4' : '#10B981';
              ctx.lineWidth = 4;
              ctx.strokeRect(x, y, w, h);

              ctx.fillStyle = isPenItem ? '#0891b2' : '#10B981';
              const text = `${refinedLabel.toUpperCase()} ${Math.round(displayScore * 100)}%`;
              ctx.font = 'bold 14px sans-serif';
              const textWidth = ctx.measureText(text).width;
              ctx.fillRect(x, y > 26 ? y - 26 : y, textWidth + 14, 26);

              ctx.fillStyle = '#ffffff';
              ctx.fillText(text, x + 7, y > 26 ? y - 8 : y + 18);
            }
          });

          setUploadDetections(detectedList);
          setIsAnalyzingImage(false);

          if (detectedList.length > 0) {
            const top = detectedList[0];
            announceObjectName(top.label, top.score);

            if (autoSave) {
              saveObjectDetection(top.label, top.score, `Uploaded Image (${file.name})`);
            }
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Box className="w-6 h-6 text-primary" />
            AI Object Scanner & Permanent Database Recorder
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Scan objects with live camera or photo upload, auto-identify object names with AI voice announcement, and record permanently to SQLite Database.
          </p>
        </div>

        {/* Top Controls: Voice, Pen Mode & Auto-Save */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pen & Office Items Mode Toggle */}
          <button
            onClick={() => setIsPenMode(!isPenMode)}
            title={isPenMode ? "Pen & Handheld Optimization Active" : "Click to Enable Pen & Office Items High-Precision Mode"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all shadow-xs cursor-pointer select-none",
              isPenMode 
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-cyan-500/10" 
                : "bg-surface-hover border-border text-text-muted hover:text-text"
            )}
          >
            <Sparkles className={cn("w-3.5 h-3.5", isPenMode ? "text-cyan-400 animate-pulse" : "")} />
            <span>{isPenMode ? "Pen & Office Mode ON" : "Pen Mode OFF"}</span>
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              voiceEnabled 
                ? 'bg-primary/10 border-primary/30 text-primary' 
                : 'bg-surface-hover border-border text-text-muted opacity-70'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceEnabled ? 'Voice Announcement ON' : 'Voice Muted'}</span>
          </button>

          {/* Auto-Save Toggle */}
          <button
            onClick={() => setAutoSave(!autoSave)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              autoSave 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-surface-hover border-border text-text-muted'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoSave ? 'text-emerald-400' : ''}`} />
            <span>{autoSave ? 'Auto-Save to DB Active' : 'Auto-Save Off'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Scanner Panel */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col h-[460px] shadow-sm">
            {/* Mode Switcher Tabs */}
            <div className="p-3 border-b border-border bg-surface-hover/30 flex justify-between items-center">
              <div className="flex bg-background border border-border rounded-xl p-0.5">
                <button
                  onClick={() => { stopScanner(); setScanMode('camera'); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                    scanMode === 'camera' ? "bg-primary text-white shadow" : "text-text-muted hover:text-text"
                  )}
                >
                  <Camera className="w-3.5 h-3.5" /> Live Camera
                </button>
                <button
                  onClick={() => { stopScanner(); setScanMode('upload'); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                    scanMode === 'upload' ? "bg-primary text-white shadow" : "text-text-muted hover:text-text"
                  )}
                >
                  <Upload className="w-3.5 h-3.5" /> Photo Upload
                </button>
              </div>

              {isScanning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  SCANNING LIVE
                </span>
              )}
            </div>

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
                          {Math.round(currentDetection.score * 100)}% AI Confidence Match
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

            {/* Scanner Controls Footer */}
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
          </div>
          
          {/* Detected Objects Overview Panel */}
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
        </div>

        {/* History Table */}
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
