import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  CameraOff, 
  Zap,
  Upload,
  Camera,
  Cpu,
  UserCheck,
  Loader2,
  Lock,
  ShieldAlert,
  LogIn,
  LogOut
} from 'lucide-react';
import { api } from '../lib/api';

interface FaceRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPunchMode?: 'in' | 'out';
}

interface RecognizedEmployee {
  id: string;
  name: string;
  employee_id: string;
  department?: string | null;
  designation?: string | null;
}

interface AttendanceNotice {
  name: string;
  employee_id: string;
  check_in: string;
  status: 'Marked' | 'Already Marked';
  punch_type?: 'in' | 'out';
}

interface FacenoxFaceResult {
  track_id?: number;
  bbox: { x: number; y: number; width: number; height: number };
  landmarks?: number[][];
  liveness: {
    is_real: boolean;
    status: string;
    confidence: number;
  };
  match_found: boolean;
  similarity: number;
  confidence: number;
  employee?: RecognizedEmployee;
  attendance_marked?: boolean;
  attendance_already_marked?: boolean;
  attendance_time?: string;
  attendance_message?: string;
}

export function FaceRecognitionModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialPunchMode = 'in'
}: FaceRecognitionModalProps) {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const isSecure = typeof window !== 'undefined' && 
    (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Punch Mode: 'in' (Check-in/Entry) or 'out' (Check-out/Exit)
  const [punchMode, setPunchMode] = useState<'in' | 'out'>(initialPunchMode);

  useEffect(() => {
    if (initialPunchMode) {
      setPunchMode(initialPunchMode);
    }
  }, [initialPunchMode, isOpen]);

  // Camera Mode: 'browser' (HTML5 WebRTC - recommended) or 'hardware' (Direct USB WebCam backend)
  // Default to 'browser' so laptop webcam opens instantly without black screen
  const [cameraMode, setCameraMode] = useState<'hardware' | 'browser'>('browser');

  const [activeEmployee, setActiveEmployee] = useState<RecognizedEmployee | null>(null);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rawErrorDetail, setRawErrorDetail] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Status message for video overlay
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Facenox scanner...');
  const [statusLabel, setStatusLabel] = useState<string>('Scanning...');
  const [statusType, setStatusType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  // Attendance confirmation banner state
  const [lastAttendanceNotice, setLastAttendanceNotice] = useState<AttendanceNotice | null>(null);

  // Hardware direct frame preview (data:image/jpeg;base64,...)
  const [hardwareFrame, setHardwareFrame] = useState<string | null>(null);

  // Uploaded photo preview state
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isScanningFrameRef = useRef(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Laser scan line position states
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);

  const lastFacesRef = useRef<FacenoxFaceResult[]>([]);

  // Stop camera stream & cancel animation loops
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isScanningFrameRef.current = false;
    lastFacesRef.current = [];
  }, []);

  // Auto-switch to browser camera when opened on EC2/Cloud
  useEffect(() => {
    if (isOpen && !isLocal) {
      setCameraMode('browser');
    }
  }, [isOpen, isLocal]);

  // Unified face detection and attendance state handler (used by Hardware, Browser Cam & Photo upload)
  const handleDetectionFaces = useCallback((faces: FacenoxFaceResult[], timestamp?: string) => {
    lastFacesRef.current = faces;

    if (faces.length === 0) {
      setStatusLabel('Scanning');
      setStatusMessage('Looking for human faces...');
      setStatusType('info');
      setActiveEmployee(null);
    } else {
      const firstFace = faces[0];
      const isMatched = Boolean(firstFace.match_found && firstFace.employee);

      if (isMatched && firstFace.employee) {
        setActiveEmployee(firstFace.employee);
        setStatusLabel('Recognized');
        setStatusMessage(`${firstFace.employee.name} (${Math.round(firstFace.confidence * 100)}%)`);
        setStatusType('success');

        if (firstFace.attendance_marked) {
          setLastAttendanceNotice({
            name: firstFace.employee.name,
            employee_id: firstFace.employee.employee_id,
            check_in: firstFace.attendance_time || timestamp || 'Now',
            status: 'Marked',
            punch_type: punchMode,
          });
          onSuccess?.();
        } else if (firstFace.attendance_already_marked) {
          setLastAttendanceNotice({
            name: firstFace.employee.name,
            employee_id: firstFace.employee.employee_id,
            check_in: firstFace.attendance_time || 'Earlier today',
            status: 'Already Marked',
            punch_type: punchMode,
          });
          onSuccess?.();
        }
      } else if (!firstFace.liveness?.is_real && !isMatched) {
        setStatusLabel('Spoof Alert');
        setStatusMessage(`Anti-spoofing alert: ${firstFace.liveness?.status || 'Spoof'}`);
        setStatusType('error');
        setActiveEmployee(null);
      } else {
        setStatusLabel('Unrecognized');
        setStatusMessage('Unknown Face — Not Registered');
        setStatusType('warning');
        setActiveEmployee(null);
      }
    }
  }, [onSuccess]);

  // Hardware Camera Direct Polling Loop
  const pollHardwareCamera = useCallback(async () => {
    if (isScanningFrameRef.current) return;
    try {
      isScanningFrameRef.current = true;
      const res = await api.post('/attendance/hardware-webcam/scan', {});
      if (res.data?.success) {
        setCameraError(null);
        setRawErrorDetail(null);
        setApiError(null);

        if (res.data.frame) {
          setHardwareFrame(res.data.frame);
        }

        const faces: FacenoxFaceResult[] = res.data.faces || [];
        handleDetectionFaces(faces, res.data.timestamp_ist);
      } else if (res.data?.error) {
        setCameraError(res.data.error);
        if (!isLocal) {
          setStatusLabel('Hardware Notice');
          setStatusMessage('No USB camera on EC2 server. Switch to Browser Cam.');
          setStatusType('warning');
        }
      }
    } catch (err: any) {
      console.warn('Hardware camera scan error:', err);
    } finally {
      isScanningFrameRef.current = false;
    }
  }, [handleDetectionFaces, isLocal]);

  // Browser Camera Stream Starter (with progressive fallback)
  const startBrowserCamera = useCallback(async () => {
    try {
      stopCamera();
      setCameraError(null);
      setRawErrorDetail(null);
      setApiError(null);
      setUploadedPreview(null);
      setHardwareFrame(null);
      setStatusMessage('Requesting browser webcam access...');
      setStatusLabel('Initializing...');
      setStatusType('info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isSecure) {
          const insecureErr = new Error('INSECURE_ORIGIN');
          insecureErr.name = 'InsecureOriginError';
          throw insecureErr;
        }
        throw new Error('Camera MediaDevices API is not supported by your browser.');
      }

      // Try basic video: true first to prevent overconstraint bugs
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err1: any) {
        console.warn('Raw video: true failed, trying facingMode user...', err1);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }

      if (!stream) {
        throw new Error('Unable to start browser camera.');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setStatusMessage('Facenox biometric scanner active');
      setStatusLabel('Ready');
      setStatusType('info');
    } catch (err: any) {
      console.error('Browser camera access error:', err);
      if (err.message === 'INSECURE_ORIGIN' || !isSecure) {
        setCameraError('INSECURE_ORIGIN');
        setRawErrorDetail('Camera blocked by browser: HTTP origin on public IP is not a Secure Context. Switch to HTTPS or enable Chrome Insecure Origin flag.');
        setStatusLabel('HTTPS Required');
        setStatusMessage('Camera requires HTTPS on remote IP');
        setStatusType('warning');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('PERMISSION_DENIED');
        setRawErrorDetail('Camera permission denied by user. Click the camera icon in Chrome address bar to Allow.');
        setStatusLabel('Permission Denied');
        setStatusMessage('Please allow camera in Chrome');
        setStatusType('error');
      } else {
        setCameraError(err.message || 'Camera access failed.');
        setRawErrorDetail(`${err?.name || 'Error'}: ${err?.message || 'Access failed'}`);
        setStatusLabel('Camera Notice');
        setStatusType('error');
      }
    }
  }, [stopCamera, isSecure]);

  // Main lifecycle effect
  useEffect(() => {
    if (isOpen) {
      if (cameraMode === 'hardware') {
        stopCamera();
        setCameraError(null);
        void pollHardwareCamera();
        const interval = setInterval(() => {
          void pollHardwareCamera();
        }, 280);
        scanIntervalRef.current = interval;
      } else {
        void startBrowserCamera();
      }
    } else {
      stopCamera();
      setCameraError(null);
      setRawErrorDetail(null);
      setApiError(null);
      setLastAttendanceNotice(null);
      setUploadedPreview(null);
      setHardwareFrame(null);
      setActiveEmployee(null);
    }
    return stopCamera;
  }, [isOpen, cameraMode, startBrowserCamera, pollHardwareCamera, stopCamera]);

  // Submit attendance manually to DB and update table history (Punch In or Punch Out)
  const handleManualSubmitAttendance = async (emp?: RecognizedEmployee | null, explicitPunch?: 'in' | 'out') => {
    const target = emp || activeEmployee;
    if (!target) return;
    const mode = explicitPunch || punchMode;
    try {
      setSubmittingAttendance(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      await api.post('/attendance/punch', {
        employee_id: target.employee_id,
        employee_name: target.name,
        punch_type: mode,
        attendance_date: today,
        camera_name: 'Facenox Live Scanner',
        confidence: 100.0,
      });

      setLastAttendanceNotice({
        name: target.name,
        employee_id: target.employee_id,
        check_in: timeStr,
        status: 'Marked',
        punch_type: mode,
      });
      setStatusLabel(mode === 'out' ? 'Punched Out' : 'Punched In');
      setStatusMessage(`${mode === 'out' ? 'Punch Out' : 'Punch In'} recorded for ${target.name}`);
      setStatusType('success');
      onSuccess?.();
    } catch (err: any) {
      console.error('Submit attendance error:', err);
      setApiError(err.response?.data?.detail || 'Failed to submit attendance.');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Browser Camera Scan Frame Method
  const scanBrowserFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2 || isScanningFrameRef.current) {
      return;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = 640;
    offCanvas.height = 480;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, 640, 480);
    const b64 = offCanvas.toDataURL('image/jpeg', 0.80);

    try {
      isScanningFrameRef.current = true;
      const res = await api.post('/attendance/facenox-scan', {
        image: b64,
        auto_mark_attendance: true,
        enable_liveness: true,
        camera_name: 'Terminal-Gate-1',
        punch_type: punchMode,
      });
      if (res.data?.success) {
        setApiError(null);
        const faces: FacenoxFaceResult[] = res.data.faces || [];
        handleDetectionFaces(faces, res.data.timestamp_ist);
      }
    } catch (err: any) {
      console.warn('Browser frame scan error:', err);
    } finally {
      isScanningFrameRef.current = false;
    }
  }, [handleDetectionFaces]);

  // Interval for browser mode
  useEffect(() => {
    if (!isOpen || cameraMode !== 'browser' || cameraError || uploadedPreview) return;
    const interval = setInterval(() => {
      void scanBrowserFrame();
    }, 280);
    return () => clearInterval(interval);
  }, [isOpen, cameraMode, cameraError, uploadedPreview, scanBrowserFrame]);

  // Upload test photo handler
  const handleUploadTestPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setUploadedPreview(b64);
      setCameraError(null);
      setStatusMessage('Analyzing photo with Facenox...');
      setStatusLabel('Processing');
      setStatusType('info');

      try {
        const res = await api.post('/attendance/facenox-scan', {
          image: b64,
          auto_mark_attendance: true,
          enable_liveness: true,
          camera_name: 'Upload-Terminal',
        });
        if (res.data?.success) {
          const faces: FacenoxFaceResult[] = res.data.faces || [];
          handleDetectionFaces(faces, res.data.timestamp_ist);
        }
      } catch (err) {
        console.error('Upload test error:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Canvas Overlay Renderer (Bounding Boxes & Laser Lines)
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = 640;
      canvas.height = 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const faces = lastFacesRef.current;

      faces.forEach((face) => {
        const b = face.bbox;
        const x = b.x;
        const y = b.y;
        const w = b.width;
        const h = b.height;

        const isMatched = Boolean(face.match_found && face.employee);
        const isReal = Boolean(face.liveness?.is_real ?? true) || isMatched;

        let strokeColor = '#10B981'; // Emerald
        if (!isReal && !isMatched) {
          strokeColor = '#EF4444'; // Red
        } else if (!isMatched) {
          strokeColor = '#F59E0B'; // Amber
        }

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 10;

        const cornerLen = Math.min(w, h) * 0.22;

        // Draw glowing corners
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
        ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
        ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
        ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
        ctx.stroke();

        ctx.fillStyle = isMatched
          ? 'rgba(16, 185, 129, 0.08)'
          : isReal
          ? 'rgba(245, 158, 11, 0.08)'
          : 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(x, y, w, h);

        drawLaserBeam(ctx, x, y, w, h, strokeColor);

        ctx.shadowBlur = 0;

        // 1. Top Status Pill
        const livenessText = isMatched 
          ? `🟢 RECOGNIZED EMPLOYEE (${Math.round((face.confidence || 0.85) * 100)}%)`
          : isReal 
          ? `🟢 REAL HUMAN (${Math.round((face.liveness?.confidence || 0.98) * 100)}%)`
          : `🔴 SPOOF ALERT (${face.liveness?.status?.toUpperCase() || 'SPOOF'})`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const liveWidth = ctx.measureText(livenessText).width;
        ctx.fillStyle = isMatched || isReal ? 'rgba(6, 78, 59, 0.88)' : 'rgba(153, 27, 27, 0.92)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, Math.max(10, y - 28), liveWidth + 16, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(livenessText, x + 8, Math.max(25, y - 13));

        // 2. Bottom Identity Info Card (Step B3 Compliant)
        if (isMatched && face.employee) {
          const line1 = `Employee Name: ${face.employee.name}`;
          const line2 = `Employee ID: ${face.employee.employee_id}`;
          const line3 = `Status: Recognized (${Math.round(face.confidence * 100)}%)`;

          ctx.font = 'bold 12px Inter, sans-serif';
          const maxTextW = Math.max(
            ctx.measureText(line1).width,
            ctx.measureText(line2).width,
            ctx.measureText(line3).width
          );

          const cardW = maxTextW + 22;
          const cardH = 58;
          let cardY = y + h + 10;
          if (cardY + cardH > canvas.height - 10) {
            cardY = Math.max(10, y - cardH - 34);
          }

          ctx.fillStyle = 'rgba(6, 78, 59, 0.94)';
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x, cardY, cardW, cardH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillText(line1, x + 10, cardY + 18);

          ctx.fillStyle = '#A7F3D0';
          ctx.font = '600 11px Inter, sans-serif';
          ctx.fillText(line2, x + 10, cardY + 34);

          ctx.fillStyle = '#6EE7B7';
          ctx.font = '500 10px Inter, sans-serif';
          ctx.fillText(line3, x + 10, cardY + 49);
        } else if (!isMatched && isReal) {
          const unkText = 'Unknown Face — Not Registered';
          ctx.font = 'bold 12px Inter, sans-serif';
          const uw = ctx.measureText(unkText).width;
          let cardY = y + h + 10;
          if (cardY + 28 > canvas.height - 10) cardY = Math.max(10, y - 60);

          ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, cardY, uw + 20, 26, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(unkText, x + 10, cardY + 17);
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  // Laser beam animation inside active face box
  const drawLaserBeam = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) => {
    ctx.save();
    const scanSpeed = h * 0.035;
    scanYRef.current += scanSpeed * scanDirRef.current;
    if (scanYRef.current >= h) {
      scanYRef.current = h;
      scanDirRef.current = -1;
    } else if (scanYRef.current <= 0) {
      scanYRef.current = 0;
      scanDirRef.current = 1;
    }

    const currentY = y + scanYRef.current;
    const gradient = ctx.createLinearGradient(x, currentY, x + w, currentY);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, currentY);
    ctx.lineTo(x + w, currentY);
    ctx.stroke();
    ctx.restore();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header with Camera Mode Selector */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text">Facenox Live Attendance Scanner</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  REAL-TIME AI
                </span>
              </div>
              <p className="text-xs text-text-muted">YuNet Detector &bull; Anti-Spoofing &bull; ArcFace 512d &bull; Auto Check-in</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Punch Mode Selector: Punch In vs Punch Out */}
            <div className="flex items-center bg-[#0a0f1d] p-1 rounded-xl border border-border text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setPunchMode('in')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  punchMode === 'in'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/50'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Punch In Mode: Auto-record entry time"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-300" />
                <span>Punch In</span>
              </button>
              <button
                type="button"
                onClick={() => setPunchMode('out')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  punchMode === 'out'
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400/50'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Punch Out Mode: Auto-record exit time"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>Punch Out</span>
              </button>
            </div>

            {/* Mode Toggle: Direct Hardware vs Browser Webcam */}
            <div className="flex items-center bg-[#0a0f1d] p-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setCameraMode('browser')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  cameraMode === 'browser'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Use laptop / built-in webcam via browser WebRTC (Recommended)"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-200" />
                <span>Browser Cam (Recommended)</span>
              </button>
              <button
                onClick={() => setCameraMode('hardware')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  cameraMode === 'hardware'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
                title="DirectShow Native Hardware WebCam (OpenCV backend)"
              >
                <Cpu className="w-3 h-3 text-cyan-300" />
                <span>Direct USB WebCam</span>
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video & Canvas Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-border">
          {cameraMode === 'browser' && cameraError && !uploadedPreview ? (
            cameraError === 'INSECURE_ORIGIN' ? (
              <div className="flex flex-col items-center gap-3 text-center p-5 bg-[#0b1329]/95 border border-amber-500/40 rounded-2xl max-w-lg z-20 m-3 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center justify-center gap-1.5">
                    <span>Webcam Access on Cloud (HTTPS Required)</span>
                  </h3>
                  <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                    Chrome & Edge protect your camera by blocking webcam access over plain HTTP on remote IP addresses (<code className="text-amber-300 font-mono text-[11px] bg-black/40 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.host : 'EC2'}</code>).
                  </p>

                  <div className="mt-3 text-left bg-black/60 p-3 rounded-xl border border-white/10 space-y-2 text-xs">
                    <div className="font-semibold text-cyan-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" /> Easy Solution (Choose 1):
                    </div>
                    <div className="text-slate-300">
                      <strong className="text-white">Option A (Fastest in Chrome — 10 sec):</strong><br />
                      1. Open new tab: <span className="text-cyan-300 font-mono select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span><br />
                      2. Add <span className="text-amber-300 font-mono select-all">http://{typeof window !== 'undefined' ? window.location.host : '18.117.247.217'}</span> &bull; Click <strong>Enabled</strong> &bull; Click <strong>Relaunch</strong>.
                    </div>
                    <div className="text-slate-300 pt-1.5 border-t border-white/10">
                      <strong className="text-white">Option B (Switch to HTTPS):</strong><br />
                      Run <code className="text-emerald-300 font-mono">bash deploy/enable-https.sh</code> on EC2, then click Open via HTTPS below.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <a
                    href={typeof window !== 'undefined' ? `https://${window.location.host}${window.location.pathname}` : '#'}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" /> Open via HTTPS
                  </a>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-hover text-text border border-border rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" /> Test with Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center p-6 bg-danger/10 border border-danger/20 rounded-xl text-danger max-w-lg z-20 m-4">
                <CameraOff className="w-10 h-10 shrink-0 text-rose-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Browser Camera Notice</h3>
                  <p className="text-xs mt-1.5 text-rose-300 leading-relaxed">
                    {rawErrorDetail || 'Browser webcam access not available. Check browser permissions.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => startBrowserCamera()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                  </button>
                  {isLocal && (
                    <button
                      onClick={() => setCameraMode('hardware')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                    >
                      <Cpu className="w-3.5 h-3.5" /> Switch to Direct USB WebCam
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-hover text-text border border-border rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" /> Test with Photo
                  </button>
                </div>
              </div>
            )
          ) : null}

          {/* Hidden File Input for Image Upload */}
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleUploadTestPhoto} 
          />

          {/* Video / Image Display */}
          {uploadedPreview ? (
            <div className="relative w-full h-full">
              <img 
                src={uploadedPreview} 
                alt="Uploaded frame" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute top-3 right-3 z-30">
                <button
                  onClick={() => {
                    setUploadedPreview(null);
                    setCameraMode(isLocal ? 'hardware' : 'browser');
                  }}
                  className="px-3 py-1 bg-black/75 hover:bg-black text-white text-[10px] font-semibold rounded-lg border border-white/20 flex items-center gap-1 shadow-lg"
                >
                  <Camera className="w-3 h-3 text-cyan-400" /> Back to Live WebCam
                </button>
              </div>
            </div>
          ) : cameraMode === 'hardware' ? (
            hardwareFrame ? (
              <div className="relative w-full h-full">
                <img 
                  src={hardwareFrame} 
                  alt="Hardware Live WebCam" 
                  className="absolute inset-0 w-full h-full object-cover" 
                />
                {/* 1-Click floating switch button to Browser Cam if screen is dark */}
                <div className="absolute bottom-4 left-4 z-30">
                  <button
                    type="button"
                    onClick={() => setCameraMode('browser')}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-emerald-400/40"
                    title="Camera black? Click here to switch to Laptop Browser Webcam"
                  >
                    <Camera className="w-4 h-4 text-emerald-200 animate-pulse" />
                    <span>Camera Black? Click to Open Laptop Camera (Browser Cam)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center p-6 bg-[#0c1427]/90 border border-cyan-500/20 rounded-2xl max-w-md z-20 m-4 shadow-xl">
                {!isLocal ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Direct USB WebCam is for Local Host</h4>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        This system is deployed on <strong>AWS EC2 Cloud</strong> (which has no physical USB webcam attached). Switch to <strong>Browser Cam</strong> to scan from your laptop camera.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCameraMode('browser')}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer mt-1"
                    >
                      <Camera className="w-3.5 h-3.5" /> Switch to Browser Cam
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                    <span>Connecting to USB2.0 HD UVC WebCam...</span>
                  </div>
                )}
              </div>
            )
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Recognition Bounding Boxes Overlay Canvas */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {/* Top Status Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-white shadow-lg">
              <span className={`w-2.5 h-2.5 rounded-full ${
                statusType === 'success' ? 'bg-emerald-400 animate-pulse' : 
                statusType === 'error' ? 'bg-rose-500 animate-pulse' : 
                statusType === 'warning' ? 'bg-amber-400' : 
                'bg-cyan-400 animate-ping'
              }`} />
              <span className="font-semibold text-xs tracking-wide uppercase text-white/90">{statusLabel}:</span>
              <span className="font-medium text-white/80">{statusMessage}</span>
            </div>

            {apiError && (
              <div className="flex items-center gap-1.5 bg-danger/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-danger/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{apiError}</span>
              </div>
            )}
          </div>

          {/* Bottom Attendance Confirmation Toast Card */}
          {lastAttendanceNotice && (
            <div className={`absolute bottom-4 left-4 right-4 backdrop-blur-md text-white p-3.5 rounded-xl flex items-center justify-between z-30 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 border ${
              lastAttendanceNotice.punch_type === 'out'
                ? 'bg-rose-950/95 border-rose-500/50' 
                : 'bg-emerald-950/95 border-emerald-500/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                  lastAttendanceNotice.punch_type === 'out'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}>
                  {lastAttendanceNotice.punch_type === 'out' ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                </div>
                <div>
                  <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${
                    lastAttendanceNotice.punch_type === 'out' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {lastAttendanceNotice.punch_type === 'out'
                      ? '✓ Punch Out Recorded'
                      : lastAttendanceNotice.status === 'Marked'
                        ? '✓ Punch In Recorded'
                        : 'Already Punched In'}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {lastAttendanceNotice.name} <span className="font-mono text-cyan-300 font-normal">({lastAttendanceNotice.employee_id})</span>
                  </div>
                </div>
              </div>
              <div className="text-right border-l border-white/10 pl-4">
                <div className="text-[10px] text-white/60 uppercase font-medium">
                  {lastAttendanceNotice.punch_type === 'out' ? 'Punch Out Time' : 'Punch In Time'}
                </div>
                <div className="text-xs font-mono font-bold text-cyan-300">{lastAttendanceNotice.check_in}</div>
              </div>
            </div>
          )}
        </div>

        {/* Manual Submit Attendance Action Bar (Step B4) */}
        {activeEmployee && (
          <div className="mx-5 my-2.5 p-3.5 bg-gradient-to-r from-emerald-950/90 via-surface to-teal-950/90 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {activeEmployee.name} <span className="text-cyan-300 font-mono font-bold">({activeEmployee.employee_id})</span>
                </span>
                <span className="text-[11px] text-emerald-300">
                  Face recognized! Click Punch In or Punch Out to record in database.
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleManualSubmitAttendance(activeEmployee, 'in')}
                disabled={submittingAttendance}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all active:scale-95"
                title="Record Punch In (Entry Time)"
              >
                {submittingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                <span>Punch In</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualSubmitAttendance(activeEmployee, 'out')}
                disabled={submittingAttendance}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all active:scale-95"
                title="Record Punch Out (Exit Time)"
              >
                {submittingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>Punch Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Info & Telemetry */}
        <div className="px-6 py-3.5 bg-surface-hover/30 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">
              Source: <strong className="text-white">{cameraMode === 'hardware' ? 'USB2.0 HD UVC WebCam' : 'Browser WebRTC'}</strong> &bull; Anti-Spoof: <strong className="text-emerald-400">Active</strong> &bull; Timezone: <strong className="text-white">Asia/Kolkata (IST)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Upload photo to test recognition"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" /> Test Photo
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-1.5 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-semibold transition-colors"
            >
              Close Scanner
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
