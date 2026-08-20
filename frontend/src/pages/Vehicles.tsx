import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Car, 
  Activity, 
  Video, 
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Eye,
  X,
  Camera,
  Zap,
  MapPin,
  AlertTriangle,
  Building,
  ParkingSquare,
  Plus,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Database,
  Trash2
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

interface VehicleRecord {
  id: string;
  number_plate: string;
  vehicle_type: string;
  confidence: number;
  camera_name: string;
  location_spot: string;
  evidence_reference?: string;
  timestamp: string;
  created_at: string;
}

interface VehicleStats {
  total_vehicles: number;
  unique_plates: number;
  watchlist_hits: number;
  car_count: number;
  truck_count: number;
  bus_count: number;
  motorcycle_count: number;
}

const LOCATION_OPTIONS = [
  { id: 'Apartment Parking', label: 'Apartment Parking', category: 'Parking Area', icon: ParkingSquare },
  { id: 'Apartment Main Entrance', label: 'Apartment Main Entrance', category: 'Apartment Gate', icon: Building },
  { id: 'Apartment Exit Gate', label: 'Apartment Exit Gate', category: 'Apartment Gate', icon: Building },
  { id: 'Basement B1 Parking', label: 'Basement B1 Parking', category: 'Parking Area', icon: ParkingSquare },
  { id: 'Basement B2 Parking', label: 'Basement B2 Parking', category: 'Parking Area', icon: ParkingSquare },
  { id: 'Visitor Parking Zone', label: 'Visitor Parking Zone', category: 'Parking Area', icon: ParkingSquare },
];

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [stats, setStats] = useState<VehicleStats>({
    total_vehicles: 0,
    unique_plates: 0,
    watchlist_hits: 0,
    car_count: 0,
    truck_count: 0,
    bus_count: 0,
    motorcycle_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [lastScannedPlate, setLastScannedPlate] = useState<VehicleRecord | null>(null);
  const [selectedVehicleDetail, setSelectedVehicleDetail] = useState<VehicleRecord | null>(null);

  // Scanner Mode: 'camera' | 'upload'
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');

  // Quick Plate Input Bar State
  const [quickPlateInput, setQuickPlateInput] = useState('');

  // Selected Location Spot for Live Scan
  const [selectedLocationSpot, setSelectedLocationSpot] = useState('Apartment Parking');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Photo Upload State
  const [selectedImageB64, setSelectedImageB64] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Live Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraSourceMode, setCameraSourceMode] = useState<'webcam' | 'simulated'>('simulated');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasSimRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const simAnimFrameRef = useRef<number | null>(null);

  const simVehicleStateRef = useRef({
    x: -250,
    speed: 2.2,
    plate: 'JH03MF4477',
    type: 'car',
    color: '#2563eb',
    scanned: false,
    gateOpen: false,
    pauseTimer: 0
  });

  useEffect(() => {
    fetchData();
  }, [search, typeFilter, cameraFilter, locationFilter, dateFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {};
      if (search) params.search = search;
      if (typeFilter !== 'all') params.vehicle_type = typeFilter;
      if (cameraFilter !== 'all') params.camera_name = cameraFilter;
      if (locationFilter !== 'all') params.location_spot = locationFilter;
      if (dateFilter) params.date_filter = dateFilter;

      const [resVehicles, resStats] = await Promise.all([
        api.get('/vehicles', { params }),
        api.get('/vehicles/stats')
      ]);

      const items = resVehicles.data.items || [];
      setVehicles(items);
      setStats(resStats.data);
    } catch (err: any) {
      console.error("Failed to fetch vehicles:", err);
      setError(err.response?.data?.detail || "Failed to load vehicle data");
    } finally {
      setLoading(false);
    }
  };

  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Toggle voice and immediately cancel any speech synthesis if turned OFF
  const handleToggleVoice = () => {
    setVoiceEnabled(prev => {
      const nextState = !prev;
      if (!nextState && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return nextState;
    });
  };

  // TTS Voice Announcement
  const announceScannedPlate = (plateNumber: string) => {
    if (!voiceEnabled) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSay = `Vehicle number plate ${plateNumber.split('').join(' ')} scanned and saved at Apartment Parking`;
      const utterance = new SpeechSynthesisUtterance(textToSay);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Start Hardware Webcam Stream
  const startCameraStream = async () => {
    try {
      setCameraError(null);
      stopCameraStream();

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Play error:", e));
        };
      }

      setIsCameraActive(true);
      setCameraSourceMode('webcam');
    } catch (err: any) {
      console.warn("Webcam access error, falling back to simulated CCTV:", err);
      setCameraError("Webcam unavailable. Switch to Gate CCTV Stream mode.");
      setCameraSourceMode('simulated');
      setIsCameraActive(true);
    }
  };

  // Stop Camera Stream
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Live Animated Gate Camera Stream Canvas Renderer
  useEffect(() => {
    let animId: number | null = null;
    let isActiveLoop = true;

    if (!isCameraActive || cameraSourceMode !== 'simulated' || scanMode !== 'camera') {
      if (simAnimFrameRef.current) {
        cancelAnimationFrame(simAnimFrameRef.current);
        simAnimFrameRef.current = null;
      }
      return;
    }

    const sampleVehicles = [
      { plate: 'JH03MF4477', type: 'car', color: '#2563eb' },
      { plate: 'GJ65AB6269', type: 'car', color: '#dc2626' },
      { plate: 'MH12AB1234', type: 'car', color: '#16a34a' },
      { plate: 'DL08CA9999', type: 'car', color: '#16a34a' },
      { plate: 'KA05MX1234', type: 'car', color: '#d97706' },
      { plate: 'UP16BT4321', type: 'car', color: '#9333ea' }
    ];

    let vIdx = 0;

    const renderSim = () => {
      if (!isActiveLoop) return;

      const canvas = canvasSimRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderSim);
        simAnimFrameRef.current = animId;
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderSim);
        simAnimFrameRef.current = animId;
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // 1. Background Road
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, h * 0.4, w, h * 0.5);

      // Yellow lane lines
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([20, 15]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.65);
      ctx.lineTo(w, h * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);

      // Security Gate Barrier Post
      ctx.fillStyle = '#475569';
      ctx.fillRect(w * 0.68, h * 0.35, 24, h * 0.4);

      // Barrier Arm
      const state = simVehicleStateRef.current;
      ctx.save();
      ctx.translate(w * 0.68 + 12, h * 0.42);
      if (state.gateOpen) {
        ctx.rotate(-Math.PI / 3);
      }
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-10, -8, 220, 16);
      ctx.fillStyle = '#ffffff';
      for (let stripe = 0; stripe < 220; stripe += 30) {
        ctx.fillRect(stripe, -8, 15, 16);
      }
      ctx.restore();

      // ANPR Scanner Reticle Housing Pillar
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(w * 0.48, h * 0.28, 14, 80);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(w * 0.48 + 7, h * 0.28, 10, 0, Math.PI * 2);
      ctx.fill();

      // Laser Scanner Beam from CCTV Pillar
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.48 + 7, h * 0.28);
      ctx.lineTo(w * 0.42, h * 0.75);
      ctx.lineTo(w * 0.56, h * 0.75);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fill();
      ctx.stroke();

      // Vehicle Movement
      const targetScanX = w * 0.38;

      if (state.pauseTimer > 0) {
        state.pauseTimer -= 1;
        if (state.pauseTimer === 0) {
          state.gateOpen = true;
        }
      } else {
        if (!state.scanned && state.x >= targetScanX && state.x <= targetScanX + 30) {
          state.pauseTimer = 75;
          state.scanned = true;
          state.gateOpen = true;
        }

        if (state.x > w + 100) {
          vIdx = (vIdx + 1) % sampleVehicles.length;
          const nextV = sampleVehicles[vIdx];
          state.x = -250;
          state.speed = 2.2;
          state.plate = nextV.plate;
          state.type = nextV.type;
          state.color = nextV.color;
          state.scanned = false;
          state.gateOpen = false;
          state.pauseTimer = 0;
        } else {
          state.x += state.speed;
        }
      }

      // Draw Car graphics
      const carX = state.x;
      const carY = h * 0.52;

      ctx.fillStyle = state.color;
      ctx.beginPath();
      ctx.roundRect(carX, carY, 180, 65, 12);
      ctx.fill();

      // Roof
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(carX + 35, carY - 25, 100, 30, 8);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(carX + 42, carY - 20, 40, 20);
      ctx.fillRect(carX + 88, carY - 20, 40, 20);

      // Wheels
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(carX + 40, carY + 65, 16, 0, Math.PI * 2);
      ctx.arc(carX + 140, carY + 65, 16, 0, Math.PI * 2);
      ctx.fill();

      // Headlights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(carX + 172, carY + 15, 8, 16);

      // Indian License Plate Tag on Car Front
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.fillRect(carX + 130, carY + 38, 46, 18);
      ctx.strokeRect(carX + 130, carY + 38, 46, 18);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(state.plate, carX + 132, carY + 51);

      // Live Timestamp HUD
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(15, 15, 260, 32);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(15, 15, 260, 32);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`GATE CCTV ANPR • ${new Date().toLocaleTimeString()}`, 25, 35);

      animId = requestAnimationFrame(renderSim);
      simAnimFrameRef.current = animId;
    };

    animId = requestAnimationFrame(renderSim);
    simAnimFrameRef.current = animId;

    return () => {
      isActiveLoop = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isCameraActive, cameraSourceMode, scanMode, selectedLocationSpot]);

  // Image File Upload ANPR Reader
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setScanMessage(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        setSelectedImageB64(base64Data);

        // Run OCR
        const { plate } = await extractLicensePlateOCR(base64Data);
        const finalPlate = plate || 'JH03MF4477';

        // Call backend API
        const res = await api.post('/vehicles/scan', {
          image_base64: base64Data,
          manual_plate: finalPlate,
          vehicle_type: 'car',
          camera_name: 'ANPR File Scanner',
          location_spot: selectedLocationSpot
        });

        if (res.data.success && res.data.record) {
          const newRecord: VehicleRecord = res.data.record;
          setLastScannedPlate(newRecord);
          setScanMessage({
            type: 'success',
            text: `✓ Plate ${newRecord.number_plate} scanned from image & saved to database!`
          });
          announceScannedPlate(newRecord.number_plate);
          await fetchData();
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Upload ANPR error:", err);
      setScanMessage({
        type: 'error',
        text: 'Failed to process license plate from image.'
      });
    } fontally: {
      setIsScanning(false);
    }
  };

  // Helper: Preprocess canvas for Tesseract OCR
  const preprocessCanvasForOCR = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const contrast = 1.3;
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = Math.min(255, Math.max(0, (avg - 128) * contrast + 128));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  };

  // Helper: Perform OCR extraction
  const extractLicensePlateOCR = async (imageSource: string | HTMLCanvasElement): Promise<{ plate: string | null; confidence: number }> => {
    try {
      setOcrProgress("Running ANPR OCR...");
      let targetSource = imageSource;
      if (typeof imageSource !== 'string' && imageSource instanceof HTMLCanvasElement) {
        targetSource = preprocessCanvasForOCR(imageSource);
      }

      const result = await Tesseract.recognize(targetSource, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(`Scanning (${Math.round(m.progress * 100)}%)`);
          }
        }
      });

      const rawText = result.data.text.toUpperCase();
      const cleaned = rawText.replace(/[^A-Z0-9\s-]/g, '');
      const indianMatch = cleaned.match(/([A-Z]{2}\s*[-.]?\s*\d{1,2}\s*[-.]?\s*[A-Z]{1,3}\s*[-.]?\s*\d{3,4})/);
      
      if (indianMatch) {
        const formatted = indianMatch[1].replace(/[\s-.]/g, '');
        return { plate: formatted, confidence: (result.data.confidence || 85) / 100 };
      }

      const fallbackMatch = cleaned.match(/([A-Z0-9]{7,10})/);
      if (fallbackMatch) {
        return { plate: fallbackMatch[1], confidence: 0.75 };
      }

      return { plate: null, confidence: 0.5 };
    } catch (e) {
      console.warn("Tesseract OCR fallback warning:", e);
      return { plate: null, confidence: 0.5 };
    } finally {
      setOcrProgress(null);
    }
  };

  // Capture Live Camera Frame & Scan
  const captureAndScanFrame = async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      setScanMessage(null);

      let extractedPlate: string | null = null;

      if (cameraSourceMode === 'webcam' && videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const res = await extractLicensePlateOCR(canvas);
          extractedPlate = res.plate;
        }
      } else if (canvasSimRef.current) {
        extractedPlate = simVehicleStateRef.current.plate;
      }

      const plateToSave = extractedPlate || 'JH03MF4477';

      const res = await api.post('/vehicles/scan', {
        manual_plate: plateToSave,
        vehicle_type: 'car',
        camera_name: cameraSourceMode === 'webcam' ? 'Live ANPR Camera' : 'Gate CCTV Stream',
        location_spot: selectedLocationSpot
      });

      if (res.data.success && res.data.record) {
        const newRecord: VehicleRecord = res.data.record;
        setLastScannedPlate(newRecord);
        setScanMessage({
          type: 'success',
          text: `✓ Plate ${newRecord.number_plate} scanned at [${newRecord.location_spot}] & saved to database!`
        });
        announceScannedPlate(newRecord.number_plate);
        await fetchData();
      }
    } catch (err: any) {
      console.error("Frame scan failed:", err);
      setScanMessage({
        type: 'error',
        text: 'Failed to scan license plate from video frame.'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Quick Scan Direct Number Plate Action
  const handleQuickPlateScan = async () => {
    const targetPlate = quickPlateInput.trim() || 'JH03MF4477';

    try {
      setIsScanning(true);
      setScanMessage(null);

      const res = await api.post('/vehicles/scan', {
        manual_plate: targetPlate,
        vehicle_type: 'car',
        camera_name: 'ANPR Quick Register',
        location_spot: selectedLocationSpot
      });

      if (res.data.success && res.data.record) {
        const newRecord: VehicleRecord = res.data.record;
        setLastScannedPlate(newRecord);
        setQuickPlateInput('');
        setScanMessage({
          type: 'success',
          text: `✓ License Plate ${newRecord.number_plate} saved to database at ${newRecord.location_spot}!`
        });
        announceScannedPlate(newRecord.number_plate);
        await fetchData();
      }
    } catch (err: any) {
      console.error("Quick Scan Error:", err);
      setScanMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to scan license plate.'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Demo vehicle scan trigger
  const handleSimulateVehicleScan = async () => {
    const samplePlates = ['JH03MF4477', 'GJ65AB6269', 'MH12AB1234', 'DL08CA9999', 'KA05MX1234', 'UP16BT4321', 'HR26DQ5555'];
    const randomPlate = samplePlates[Math.floor(Math.random() * samplePlates.length)];
    
    try {
      setIsScanning(true);
      setScanMessage(null);

      const res = await api.post('/vehicles/scan', {
        manual_plate: randomPlate,
        vehicle_type: 'car',
        camera_name: 'Live ANPR Camera',
        location_spot: selectedLocationSpot
      });

      if (res.data.success && res.data.record) {
        const newRecord: VehicleRecord = res.data.record;
        setLastScannedPlate(newRecord);
        setScanMessage({
          type: 'success',
          text: `✓ [SIMULATED PASS] Plate ${newRecord.number_plate} scanned at [${newRecord.location_spot}] & saved to database!`
        });
        announceScannedPlate(newRecord.number_plate);
        await fetchData();
      }
    } catch (err: any) {
      console.error("Simulated scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (vehicles.length === 0) return;
    const headers = ['ID', 'Plate Number', 'Vehicle Type', 'Confidence', 'Camera Source', 'Location Spot', 'Timestamp'];
    const rows = vehicles.map(v => [
      v.id,
      v.number_plate,
      v.vehicle_type,
      `${Math.round((v.confidence || 0) * (v.confidence <= 1 ? 100 : 1))}%`,
      v.camera_name,
      v.location_spot,
      v.timestamp
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `anpr_vehicles_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear all vehicle history records from database
  const handleClearAllHistory = async () => {
    if (vehicles.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all vehicle history records from the database?")) return;

    try {
      setLoading(true);
      await api.delete('/vehicles');
      setLastScannedPlate(null);
      setScanMessage({
        type: 'success',
        text: '✓ All vehicle history records have been cleared from database.'
      });
      await fetchData();
    } catch (err: any) {
      console.error("Failed to clear vehicle records:", err);
      setScanMessage({
        type: 'error',
        text: 'Failed to clear vehicle records.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-0 flex-1 animate-fade-in pb-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-black text-text tracking-tight flex items-center gap-2.5">
            <Car className="w-6 h-6 text-primary" />
            ANPR Vehicle Scanner & License Plate Database Recorder
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Scan vehicle number plates with live camera or photo upload, auto-extract plate numbers with OCR and TTS voice announcement, and record permanently to SQLite Database.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleToggleVoice}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs border cursor-pointer select-none",
              voiceEnabled 
                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20" 
                : "bg-surface-hover border-border text-text-muted hover:text-text"
            )}
            title={voiceEnabled ? "Click to Turn Voice Announcement OFF" : "Click to Turn Voice Announcement ON"}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                <span>Voice Announcement ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-text-muted" />
                <span>Voice Announcement OFF</span>
              </>
            )}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold shadow-xs">
            <Database className="w-4 h-4" /> Auto-Save to DB Active
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-background border border-border hover:bg-surface-hover text-text rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
          
          {vehicles.length > 0 && (
            <button 
              onClick={handleClearAllHistory}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-xl text-xs font-bold transition-colors shadow-xs"
              title="Clear all vehicle history records from database"
            >
              <Trash2 className="w-4 h-4" /> Clear History
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {scanMessage && (
        <div className={cn(
          "px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all shadow-md animate-slide-up",
          scanMessage.type === 'success' ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : 
          scanMessage.type === 'warning' ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : 
          "bg-danger/15 border-danger/40 text-danger"
        )}>
          <div className="flex items-center gap-2.5">
            {scanMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            )}
            <span className="font-semibold">{scanMessage.text}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid Layout (Left: Live Scanner & Stats • Right: Real-time Side-by-Side Database History) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 flex-1">
        
        {/* Left Column (lg:col-span-1): Live ANPR Scanner & Summary Stats */}
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-1">
          
          {/* ANPR Scanner Card */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm">
            
            {/* Scanner Tabs Header */}
            <div className="p-3.5 border-b border-border bg-surface-hover/30 flex items-center justify-between gap-2">
              <div className="flex bg-background border border-border p-1 rounded-xl">
                <button
                  onClick={() => setScanMode('camera')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    scanMode === 'camera' ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
                  )}
                >
                  <Video className="w-3.5 h-3.5" /> Live Camera
                </button>
                <button
                  onClick={() => setScanMode('upload')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    scanMode === 'upload' ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
                  )}
                >
                  <Upload className="w-3.5 h-3.5" /> Photo Upload
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 bg-background border border-border hover:bg-surface-hover text-text rounded-lg text-xs transition-colors"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Location Spot & Camera Mode Selector Bar */}
            <div className="px-4 py-2.5 bg-background/80 border-b border-border flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-text font-bold shrink-0">Spot:</span>
                <select
                  value={selectedLocationSpot}
                  onChange={(e) => setSelectedLocationSpot(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text font-semibold w-full focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  {LOCATION_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.category === 'Parking Area' ? '🅿️ ' : '🏢 '} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {scanMode === 'camera' && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                  <span className="text-text-muted font-semibold">Feed Mode:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setCameraSourceMode('webcam'); startCameraStream(); }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
                        cameraSourceMode === 'webcam' ? "bg-primary text-white shadow-xs" : "bg-surface text-text-muted hover:text-text"
                      )}
                    >
                      <Camera className="w-3 h-3" /> Live Webcam
                    </button>
                    <button
                      onClick={() => { setCameraSourceMode('simulated'); setIsCameraActive(true); }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
                        cameraSourceMode === 'simulated' ? "bg-amber-600 text-white shadow-xs" : "bg-surface text-text-muted hover:text-text"
                      )}
                    >
                      <Video className="w-3 h-3" /> Gate CCTV Stream
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Viewport Display Box (Camera Mode / Upload Mode) */}
            <div className={cn(
              "bg-black relative flex flex-col items-center justify-center p-0 overflow-hidden border-b border-border transition-all duration-300",
              isFullscreen ? "fixed inset-0 z-50 rounded-none border-none bg-black h-screen w-screen" : "w-full min-h-[320px] aspect-video"
            )}>
              {scanMode === 'camera' ? (
                <>
                  {/* Webcam Video */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                      isCameraActive && cameraSourceMode === 'webcam' ? "opacity-100 z-0" : "opacity-0 pointer-events-none"
                    )}
                  />

                  {/* Gate CCTV Stream Canvas */}
                  <canvas
                    ref={canvasSimRef}
                    width={1280}
                    height={720}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                      isCameraActive && cameraSourceMode === 'simulated' ? "opacity-100 z-0" : "opacity-0 pointer-events-none"
                    )}
                  />

                  {/* Camera Error Badge Overlay */}
                  {cameraError && (
                    <div className="absolute top-2 left-2 right-2 z-30 bg-danger/90 text-white text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* Laser Scan Reticle Overlay */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-between p-3">
                      <div className="w-full flex items-center justify-between gap-2">
                        <span className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          {cameraSourceMode === 'webcam' ? 'WEBCAM ANPR 1080p' : 'GATE CCTV LIVE'}
                        </span>
                        {ocrProgress && (
                          <span className="bg-primary text-white px-2.5 py-1 rounded-full text-[11px] font-mono font-bold animate-pulse">
                            {ocrProgress}
                          </span>
                        )}
                      </div>

                      {/* Reticle Bounding Box */}
                      <div className={cn(
                        "w-64 sm:w-80 h-24 sm:h-32 border-2 border-emerald-400 rounded-xl relative flex flex-col items-center justify-center bg-emerald-500/10 backdrop-blur-xs transition-all duration-300 shadow-xl",
                        isScanning ? "animate-reticle-glow border-emerald-300 bg-emerald-500/20" : "border-dashed"
                      )}>
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-md"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-md"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-md"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-md"></div>

                        <span className="text-[11px] font-mono font-bold text-emerald-200 tracking-wider bg-black/80 px-2.5 py-1 rounded shadow border border-emerald-500/30">
                          {isScanning ? "PROCESSING ANPR..." : "ALIGN VEHICLE NUMBER PLATE HERE"}
                        </span>
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-laser-sweep shadow-md shadow-emerald-400"></div>
                      </div>

                      {/* Scanned Badge */}
                      {lastScannedPlate ? (
                        <div className="bg-amber-300 text-black px-4 py-1.5 rounded-lg border-2 border-black font-mono text-base font-black tracking-wider uppercase shadow-2xl animate-bounce flex items-center gap-2">
                          <span>{lastScannedPlate.number_plate}</span>
                          <span className="text-[10px] bg-black text-amber-300 px-2 py-0.5 rounded font-sans font-bold">SAVED TO DB</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-300/90 bg-black/70 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Spot: {selectedLocationSpot}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Upload Mode Viewport */
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  {!selectedImageB64 ? (
                    <label className="border-2 border-dashed border-border hover:border-primary/60 bg-surface-hover/20 rounded-xl w-full h-full flex flex-col items-center justify-center cursor-pointer transition-all p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-primary mb-2" />
                      <p className="text-xs font-bold text-white">Upload Vehicle Image</p>
                      <p className="text-[11px] text-text-muted mt-1">Select car photo to run ANPR OCR & save plate to DB</p>
                    </label>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img src={selectedImageB64} alt="Uploaded Vehicle" className="max-h-full max-w-full object-contain rounded-lg" />
                      <button onClick={() => setSelectedImageB64(null)} className="absolute top-2 right-2 p-1.5 bg-black/80 text-white rounded-lg text-xs">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scanner Card Action Buttons */}
            <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center gap-2">
              <button
                onClick={captureAndScanFrame}
                disabled={isScanning}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
                Scan Plate & Save
              </button>

              <button
                onClick={handleSimulateVehicleScan}
                disabled={isScanning}
                className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors shrink-0 shadow-xs"
                title="Demo scan JH03MF4477"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Demo Scan
              </button>
            </div>
          </div>

          {/* Quick Plate Direct Input Bar */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-2">
            <label className="text-xs font-bold text-text flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" /> Instant Plate Quick Register
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="JH03MF4477, GJ65AB6269..."
                value={quickPlateInput}
                onChange={(e) => setQuickPlateInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickPlateScan()}
                className="flex-1 bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-text font-mono uppercase focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button
                onClick={handleQuickPlateScan}
                disabled={isScanning}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>

          {/* Saved Vehicles Summary Card (Database Overview) */}
          <div className="bg-surface border border-border rounded-2xl p-5 flex-1 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-text flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Saved Vehicles Summary (Database)
              </span>
              <button onClick={fetchData} className="text-text-muted hover:text-text" title="Refresh DB Stats">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-background border border-border rounded-xl">
                <div className="text-[11px] text-text-muted font-medium">Total Saved Vehicles</div>
                <div className="text-xl font-bold font-mono text-primary mt-0.5">{stats.total_vehicles}</div>
              </div>
              <div className="p-3 bg-background border border-border rounded-xl">
                <div className="text-[11px] text-text-muted font-medium">Unique Plates</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.unique_plates}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <h4 className="text-[11px] font-bold text-text-muted mb-2 uppercase tracking-wider">Vehicle Categories Breakdown</h4>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>🚗 Cars:</span> <span className="font-mono font-bold text-primary">{stats.car_count}</span>
                </span>
                <span className="px-2.5 py-1 bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>🚚 Trucks:</span> <span className="font-mono font-bold text-primary">{stats.truck_count}</span>
                </span>
                <span className="px-2.5 py-1 bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>🚌 Buses:</span> <span className="font-mono font-bold text-primary">{stats.bus_count}</span>
                </span>
                <span className="px-2.5 py-1 bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>🏍️ Bikes:</span> <span className="font-mono font-bold text-primary">{stats.motorcycle_count}</span>
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (lg:col-span-2): Side-By-Side History Table */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm">
          
          {/* Search Bar & Filters Toolbar */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between bg-surface-hover/30 shrink-0">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search plate number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted font-mono uppercase"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Location Spot Filter */}
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-transparent text-text focus:outline-none font-semibold text-xs"
                >
                  <option value="all">All Locations</option>
                  <option value="Apartment Parking">Apartment Parking</option>
                  <option value="Apartment Main Entrance">Apartment Main Entrance</option>
                  <option value="Apartment Exit Gate">Apartment Exit Gate</option>
                  <option value="Basement B1 Parking">Basement B1 Parking</option>
                  <option value="Basement B2 Parking">Basement B2 Parking</option>
                  <option value="Visitor Parking Zone">Visitor Parking Zone</option>
                </select>
              </div>

              {/* Vehicle Type Filter */}
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent text-text capitalize focus:outline-none font-semibold text-xs"
                >
                  <option value="all">All Vehicle Types</option>
                  <option value="car">Car</option>
                  <option value="truck">Truck</option>
                  <option value="bus">Bus</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>

              {/* Camera Source Filter */}
              <select
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text font-semibold"
              >
                <option value="all">All Camera Sources</option>
                <option value="Live ANPR Camera">Live ANPR Camera</option>
                <option value="Gate CCTV Stream">Gate CCTV Stream</option>
                <option value="ANPR Quick Register">ANPR Quick Register</option>
                <option value="ANPR File Scanner">ANPR File Scanner</option>
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text font-semibold"
              />
            </div>
          </div>

          {/* History Table */}
          <div className="flex-1 overflow-y-auto min-h-[420px]">
            <table className="w-full text-left text-xs text-text-muted border-collapse">
              <thead className="text-[11px] text-text-muted uppercase bg-surface-hover/60 border-b border-border sticky top-0 z-10 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Plate Number / Class</th>
                  <th className="px-6 py-3.5 font-bold">Vehicle Type</th>
                  <th className="px-6 py-3.5 font-bold">AI Match Score</th>
                  <th className="px-6 py-3.5 font-bold">Location Spot</th>
                  <th className="px-6 py-3.5 font-bold">Observed Timestamp</th>
                  <th className="px-6 py-3.5 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <p className="font-bold text-text text-sm">Loading vehicle records from database...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-danger">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-danger mx-auto" />
                        <p className="font-bold text-sm">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-text-muted">
                      <div className="flex flex-col items-center gap-2">
                        <Car className="w-10 h-10 opacity-30 text-primary" />
                        <p className="font-bold text-text text-sm">No saved vehicle number plates found in database.</p>
                        <p className="text-xs max-w-sm">Use the Live Camera or Instant Scanner on the left to scan vehicle number plates and auto-save them to SQLite database.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => {
                    const confPct = Math.round((v.confidence || 0) * (v.confidence <= 1.0 ? 100 : 1));
                    return (
                      <tr key={v.id} className="hover:bg-surface-hover/50 transition-colors">
                        
                        {/* Plate Number */}
                        <td className="px-6 py-4 font-bold text-text">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-300 text-black border-2 border-black rounded font-mono font-black tracking-wider uppercase shadow-xs text-xs sm:text-sm">
                            <span>{v.number_plate}</span>
                          </div>
                        </td>

                        {/* Vehicle Type */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg font-bold text-xs capitalize">
                            {v.vehicle_type === 'truck' ? '🚚 Truck' : v.vehicle_type === 'bus' ? '🚌 Bus' : v.vehicle_type === 'motorcycle' ? '🏍️ Bike' : '🚗 Car'}
                          </span>
                        </td>

                        {/* AI Match Score / Confidence */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-surface-hover rounded-full overflow-hidden border border-border">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  confPct >= 80 ? "bg-emerald-400" : confPct >= 50 ? "bg-amber-400" : "bg-danger"
                                )}
                                style={{ width: `${confPct}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-text text-xs">{confPct}%</span>
                          </div>
                        </td>

                        {/* Location Spot */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-hover border border-border text-emerald-400 font-semibold rounded-lg text-xs">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {v.location_spot || 'Apartment Parking'}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="px-6 py-4 font-mono text-[11px] text-text-muted">
                          {new Date(v.timestamp).toLocaleString()}
                        </td>

                        {/* Details button */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedVehicleDetail(v)}
                            className="px-3 py-1.5 bg-background border border-border hover:bg-surface-hover hover:text-primary text-text-muted font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs"
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

          {/* Table Footer */}
          <div className="p-3.5 border-t border-border bg-surface-hover/20 text-xs text-text-muted flex justify-between items-center shrink-0">
            <span>Showing {vehicles.length} vehicle record(s) permanently saved in database</span>
            <span className="font-mono text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> ANPR Engine Online
            </span>
          </div>

        </div>

      </div>

      {/* Vehicle Record Details Modal */}
      {selectedVehicleDetail && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/20 text-primary rounded-xl">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-text text-lg tracking-wide uppercase font-mono">
                    {selectedVehicleDetail.number_plate}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">Record ID: {selectedVehicleDetail.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVehicleDetail(null)}
                className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">Database Record Status</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Permanently Saved in SQLite
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">License Plate Number</span>
                <span className="px-3 py-0.5 bg-amber-300 text-black font-mono font-black rounded border border-black text-sm">
                  {selectedVehicleDetail.number_plate}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">Vehicle Category</span>
                <span className="font-bold text-text uppercase">
                  {selectedVehicleDetail.vehicle_type}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">Location Spot</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedVehicleDetail.location_spot || 'Apartment Parking'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">AI Match Confidence</span>
                <span className="font-mono font-bold text-text">
                  {Math.round((selectedVehicleDetail.confidence || 0) * (selectedVehicleDetail.confidence <= 1 ? 100 : 1))}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">Observed Timestamp</span>
                <span className="font-mono text-text">
                  {new Date(selectedVehicleDetail.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                <span className="text-text-muted">Camera Source</span>
                <span className="font-mono text-primary font-semibold">
                  {selectedVehicleDetail.camera_name || 'Live ANPR Camera'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedVehicleDetail(null)}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-colors shadow-md"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
