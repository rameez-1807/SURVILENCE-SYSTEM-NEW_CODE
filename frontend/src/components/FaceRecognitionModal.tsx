import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  CameraOff, 
  Check, 
  Zap 
} from 'lucide-react';
import { api } from '../lib/api';

interface FaceRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  attendance_time?: string;
}

export function FaceRecognitionModal({ isOpen, onClose }: FaceRecognitionModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Status message for video overlay
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [statusLabel, setStatusLabel] = useState<string>('Scanning...');
  const [statusType, setStatusType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  // Attendance confirmation banner state
  const [lastAttendanceNotice, setLastAttendanceNotice] = useState<AttendanceNotice | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isScanningFrameRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Laser scan line position states
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);

  const lastFacesRef = useRef<FacenoxFaceResult[]>([]);

  // Stop camera stream & cancel animation loops
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
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

  // 3. Start camera stream
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      setCameraError(null);
      setApiError(null);
      setLastAttendanceNotice(null);
      setStatusMessage('Requesting camera access...');
      setStatusLabel('Initializing...');
      setStatusType('info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

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
      console.error('Error accessing camera:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow webcam permissions in browser settings.');
      } else {
        setCameraError('Could not access camera device. Please check hardware connection.');
      }
      setStatusLabel('Camera Error');
      setStatusType('error');
    }
  }, [stopCamera]);

  // Cleanup effect on open/close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCameraError(null);
      setApiError(null);
      setLastAttendanceNotice(null);
    }
    return stopCamera;
  }, [isOpen, startCamera, stopCamera]);

  // 4. Facenox Frame Processing Loop
  const scanFacenoxFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2 || isScanningFrameRef.current) {
      return;
    }

    try {
      isScanningFrameRef.current = true;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 640;
      offCanvas.height = 480;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(video, 0, 0, 640, 480);
      const b64 = offCanvas.toDataURL('image/jpeg', 0.80);

      const res = await api.post('/attendance/facenox-scan', {
        image: b64,
        auto_mark_attendance: true,
        enable_liveness: true,
        camera_name: 'Facenox AI Terminal',
      });

      if (res.data?.success) {
        setApiError(null);
        const faces: FacenoxFaceResult[] = res.data.faces || [];
        lastFacesRef.current = faces;

        // Check if attendance was auto-marked in this frame
        if (res.data.attendance_events && res.data.attendance_events.length > 0) {
          const ev = res.data.attendance_events[0];
          setLastAttendanceNotice({
            name: ev.name,
            employee_id: ev.employee_id,
            check_in: ev.time,
          });
          setStatusLabel('Checked In');
          setStatusMessage(`Attendance marked for ${ev.name}`);
          setStatusType('success');
        } else if (faces.length === 0) {
          setStatusLabel('Scanning');
          setStatusMessage('Looking for human faces...');
          setStatusType('info');
        } else {
          const firstFace = faces[0];
          if (!firstFace.liveness.is_real) {
            setStatusLabel('Spoof Blocked');
            setStatusMessage(`Anti-spoofing alert: ${firstFace.liveness.status}`);
            setStatusType('error');
          } else if (firstFace.match_found && firstFace.employee) {
            setStatusLabel('Recognized');
            setStatusMessage(`${firstFace.employee.name} (${Math.round(firstFace.confidence * 100)}%)`);
            setStatusType('success');
          } else {
            setStatusLabel('Unrecognized');
            setStatusMessage('Real human face detected (not in roster)');
            setStatusType('warning');
          }
        }
      }
    } catch (err: any) {
      console.warn('Facenox frame scan error:', err);
      setApiError('Facenox server busy / response delayed');
    } finally {
      isScanningFrameRef.current = false;
    }
  }, []);

  // 5. Continuous Canvas Rendering Animation Loop
  useEffect(() => {
    if (!isOpen || cameraError) return;

    let animId: number;

    const renderOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animId = requestAnimationFrame(renderOverlay);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderOverlay);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Scale factors if video resolution differs from 640x480 model input
      const scaleX = canvas.width / 640;
      const scaleY = canvas.height / 480;

      const faces = lastFacesRef.current;

      faces.forEach((face) => {
        const b = face.bbox;
        const x = b.x * scaleX;
        const y = b.y * scaleY;
        const w = b.width * scaleX;
        const h = b.height * scaleY;

        const isReal = face.liveness?.is_real ?? true;
        const isMatched = face.match_found && face.employee;

        // Box Color: Red for spoof, Emerald for recognized real, Amber for unknown real
        let strokeColor = '#10B981'; // Emerald
        if (!isReal) {
          strokeColor = '#EF4444'; // Red
        } else if (!isMatched) {
          strokeColor = '#F59E0B'; // Amber
        }

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 10;

        // Corner lengths
        const cornerLen = Math.min(w, h) * 0.22;

        // Draw glowing corners
        ctx.beginPath();
        // Top-left
        ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
        // Top-right
        ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
        // Bottom-right
        ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
        // Bottom-left
        ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
        ctx.stroke();

        // Shaded fill
        ctx.fillStyle = isReal
          ? (isMatched ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)')
          : 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(x, y, w, h);

        // Laser scan line inside bounding box
        drawLaserBeam(ctx, x, y, w, h, strokeColor);

        ctx.shadowBlur = 0;

        // 1. Top Liveness Pill
        const livenessText = isReal 
          ? `🟢 REAL HUMAN (${Math.round((face.liveness.confidence || 0.98) * 100)}%)`
          : `🔴 SPOOF DETECTED (${face.liveness.status.toUpperCase()})`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const liveWidth = ctx.measureText(livenessText).width;
        ctx.fillStyle = isReal ? 'rgba(6, 78, 59, 0.85)' : 'rgba(153, 27, 27, 0.90)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, Math.max(10, y - 28), liveWidth + 16, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(livenessText, x + 8, Math.max(25, y - 13));

        // 2. Bottom Identity Info Card
        if (isMatched && face.employee) {
          const nameText = `✓ ${face.employee.name}`;
          const idText = `${face.employee.employee_id} • ${Math.round(face.confidence * 100)}% Match`;
          const deptText = face.employee.department || 'Verified Staff';

          ctx.font = 'bold 14px Inter, sans-serif';
          const nw = ctx.measureText(nameText).width;
          ctx.font = '600 11px Inter, sans-serif';
          const iw = ctx.measureText(idText).width;

          const cardW = Math.max(nw, iw) + 24;
          const cardH = 58;
          let cardY = y + h + 10;
          if (cardY + cardH > canvas.height - 10) {
            cardY = Math.max(10, y - cardH - 34);
          }

          ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x, cardY, cardW, cardH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(nameText, x + 10, cardY + 20);

          ctx.fillStyle = '#A7F3D0';
          ctx.font = '500 11px Inter, sans-serif';
          ctx.fillText(idText, x + 10, cardY + 37);

          ctx.fillStyle = '#6EE7B7';
          ctx.font = '500 10px Inter, sans-serif';
          ctx.fillText(deptText, x + 10, cardY + 50);
        } else if (!isMatched && isReal) {
          const unkText = '? Unrecognized Individual';
          ctx.font = 'bold 12px Inter, sans-serif';
          const uw = ctx.measureText(unkText).width;
          let cardY = y + h + 10;
          if (cardY + 28 > canvas.height - 10) cardY = Math.max(10, y - 60);

          ctx.fillStyle = 'rgba(120, 53, 15, 0.90)';
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
  }, [isOpen, cameraError]);

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

  // Trigger continuous Facenox frame scans every 280ms
  useEffect(() => {
    if (!isOpen || cameraError) return;
    const interval = setInterval(() => {
      void scanFacenoxFrame();
    }, 280);
    return () => clearInterval(interval);
  }, [isOpen, cameraError, scanFacenoxFrame]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text">Facenox AI Face Biometrics</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  SOTA ONNX
                </span>
              </div>
              <p className="text-xs text-text-muted">Anti-Spoofing Liveness &bull; ArcFace 512d &bull; Auto Attendance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video & Canvas Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-border">
          {cameraError ? (
            <div className="flex flex-col items-center gap-3 text-center p-6 bg-danger/10 border border-danger/20 rounded-xl text-danger max-w-md z-20">
              <CameraOff className="w-10 h-10 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Camera Access Failed</h3>
                <p className="text-xs mt-1 opacity-90">{cameraError}</p>
              </div>
              <button
                onClick={startCamera}
                className="mt-2 flex items-center gap-1.5 px-4 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
              </button>
            </div>
          ) : null}

          {/* Live Webcam Stream */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Recognition Bounding Boxes Overlay Canvas */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {/* Top Status Badges */}
          {!cameraError && (
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
          )}

          {/* Bottom Attendance Confirmation Overlay Card */}
          {lastAttendanceNotice && (
            <div className="absolute bottom-4 left-4 right-4 bg-emerald-950/95 border border-emerald-500/50 backdrop-blur-md text-white p-3.5 rounded-xl flex items-center justify-between z-30 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 uppercase tracking-wider">
                    ✓ Facenox Verified Check-in Recorded
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {lastAttendanceNotice.name} <span className="font-mono text-emerald-300 font-normal">({lastAttendanceNotice.employee_id})</span>
                  </div>
                </div>
              </div>
              <div className="text-right border-l border-white/10 pl-4">
                <div className="text-[10px] text-emerald-200/70 uppercase font-medium">MySQL Recorded</div>
                <div className="text-xs font-mono font-bold text-emerald-300">{lastAttendanceNotice.check_in}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info & Telemetry */}
        <div className="px-6 py-3.5 bg-surface-hover/30 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">
              Anti-Spoofing: <strong className="text-white">Active</strong> &bull; Engine: <strong className="text-cyan-400">Facenox YuNet + ArcFace 512d</strong>
            </span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-semibold transition-colors"
          >
            Close Scanner
          </button>
        </div>

      </div>
    </div>
  );
}
