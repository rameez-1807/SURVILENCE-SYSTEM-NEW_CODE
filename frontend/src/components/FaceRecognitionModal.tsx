import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  CameraOff, 
  Check, 
  Zap,
  Info,
  Upload,
  Camera
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
  status: 'Marked' | 'Already Marked';
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

export function FaceRecognitionModal({ isOpen, onClose }: FaceRecognitionModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rawErrorDetail, setRawErrorDetail] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Available camera devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Status message for video overlay
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [statusLabel, setStatusLabel] = useState<string>('Scanning...');
  const [statusType, setStatusType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  // Attendance confirmation banner state
  const [lastAttendanceNotice, setLastAttendanceNotice] = useState<AttendanceNotice | null>(null);

  // Static uploaded frame preview state (if testing via photo upload)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Enumerate video devices on load
  const enumerateCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (e) {
      console.warn('Failed to enumerate cameras:', e);
    }
  }, [selectedDeviceId]);

  // Multi-tier resilient camera initialization
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      setCameraError(null);
      setRawErrorDetail(null);
      setApiError(null);
      setUploadedPreview(null);
      setLastAttendanceNotice(null);
      setStatusMessage('Requesting camera access...');
      setStatusLabel('Initializing...');
      setStatusType('info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera MediaDevices API is not supported by your browser.');
      }

      let stream: MediaStream | null = null;
      const deviceConstraints = selectedDeviceId ? { exact: selectedDeviceId } : undefined;

      // Tier 1: Try requested device or ideal 640x480 resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceConstraints,
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: selectedDeviceId ? undefined : 'user',
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Camera Tier 1 failed, attempting Tier 2 fallback...', err1);
        // Tier 2: Try basic deviceId or facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' },
            audio: false,
          });
        } catch (err2) {
          console.warn('Camera Tier 2 failed, attempting Tier 3 raw video fallback...', err2);
          // Tier 3: Pure video: true
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) {
        throw new Error('Could not establish camera stream.');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      await enumerateCameras();

      setStatusMessage('Facenox biometric scanner active');
      setStatusLabel('Ready');
      setStatusType('info');
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setRawErrorDetail(`${err?.name || 'Error'}: ${err?.message || 'Access failed'}`);

      let friendly = 'Could not access camera device.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        friendly = 'Camera permission blocked. Click the lock/camera icon in your browser URL bar and choose "Allow".';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        friendly = 'Camera is currently locked by another application or browser tab. Please close other camera tabs (or apps like Zoom/Camera) and click "Retry Camera".';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        friendly = 'No webcam hardware detected. Please plug in a webcam or upload a frame to test.';
      } else if (err?.name === 'OverconstrainedError') {
        friendly = 'The selected camera does not support the requested video resolution. Please choose a different camera below.';
      } else if (err?.message) {
        friendly = err.message;
      }

      setCameraError(friendly);
      setStatusLabel('Camera Error');
      setStatusType('error');
    }
  }, [stopCamera, selectedDeviceId, enumerateCameras]);

  // Cleanup on open/close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCameraError(null);
      setRawErrorDetail(null);
      setApiError(null);
      setLastAttendanceNotice(null);
      setUploadedPreview(null);
    }
    return stopCamera;
  }, [isOpen, startCamera, stopCamera]);

  // Frame scanner API caller
  const processFrameBase64 = useCallback(async (base64Image: string) => {
    try {
      isScanningFrameRef.current = true;
      const res = await api.post('/attendance/facenox-scan', {
        image: base64Image,
        auto_mark_attendance: true,
        enable_liveness: true,
        camera_name: 'Terminal-Gate-1',
      });

      if (res.data?.success) {
        setApiError(null);
        const faces: FacenoxFaceResult[] = res.data.faces || [];
        lastFacesRef.current = faces;

        if (faces.length === 0) {
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

            // Handle Attendance Notification (Marked vs Already Marked)
            if (firstFace.attendance_marked) {
              setLastAttendanceNotice({
                name: firstFace.employee.name,
                employee_id: firstFace.employee.employee_id,
                check_in: firstFace.attendance_time || res.data.timestamp_ist || 'Now',
                status: 'Marked',
              });
            } else if (firstFace.attendance_already_marked) {
              setLastAttendanceNotice({
                name: firstFace.employee.name,
                employee_id: firstFace.employee.employee_id,
                check_in: firstFace.attendance_time || 'Earlier today',
                status: 'Already Marked',
              });
            }
          } else {
            setStatusLabel('Unrecognized');
            setStatusMessage('Unknown Face — Not Registered');
            setStatusType('warning');
          }
        }
      }
    } catch (err: any) {
      console.warn('Facenox frame scan error:', err);
      setApiError('Facenox server busy / delayed');
    } finally {
      isScanningFrameRef.current = false;
    }
  }, []);

  // Continuous frame scan loop
  const scanFacenoxFrame = useCallback(async () => {
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
    await processFrameBase64(b64);
  }, [processFrameBase64]);

  // Fallback: Test with uploaded image file
  const handleUploadTestFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setUploadedPreview(b64);
      setCameraError(null);
      setStatusMessage('Analyzing uploaded frame with Facenox...');
      setStatusLabel('Processing');
      setStatusType('info');
      await processFrameBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  // Canvas Rendering Overlay
  useEffect(() => {
    if (!isOpen || (cameraError && !uploadedPreview)) return;

    let animId: number;

    const renderOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentWidth = uploadedPreview ? 640 : (video?.videoWidth || 640);
      const currentHeight = uploadedPreview ? 480 : (video?.videoHeight || 480);

      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        const cornerLen = Math.min(w, h) * 0.22;

        // Draw glowing corners
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
        ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
        ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
        ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
        ctx.stroke();

        ctx.fillStyle = isReal
          ? (isMatched ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)')
          : 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(x, y, w, h);

        drawLaserBeam(ctx, x, y, w, h, strokeColor);

        ctx.shadowBlur = 0;

        // 1. Top Liveness Pill
        const livenessText = isReal 
          ? `🟢 REAL HUMAN (${Math.round((face.liveness.confidence || 0.98) * 100)}%)`
          : `🔴 SPOOF DETECTED (${face.liveness.status.toUpperCase()})`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const liveWidth = ctx.measureText(livenessText).width;
        ctx.fillStyle = isReal ? 'rgba(6, 78, 59, 0.88)' : 'rgba(153, 27, 27, 0.92)';
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

      if (!uploadedPreview) {
        animId = requestAnimationFrame(renderOverlay);
      }
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, cameraError, uploadedPreview]);

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

  // Continuous frame trigger interval (every 280ms)
  useEffect(() => {
    if (!isOpen || cameraError || uploadedPreview) return;
    const interval = setInterval(() => {
      void scanFacenoxFrame();
    }, 280);
    return () => clearInterval(interval);
  }, [isOpen, cameraError, uploadedPreview, scanFacenoxFrame]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
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
          
          <div className="flex items-center gap-2">
            {videoDevices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  setTimeout(startCamera, 50);
                }}
                className="bg-[#0a0f1d] border border-border text-white text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
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
          {cameraError && !uploadedPreview ? (
            <div className="flex flex-col items-center gap-3 text-center p-6 bg-danger/10 border border-danger/20 rounded-xl text-danger max-w-lg z-20 m-4">
              <CameraOff className="w-10 h-10 shrink-0 text-rose-400" />
              <div>
                <h3 className="font-bold text-sm text-white">Camera Access Notice</h3>
                <p className="text-xs mt-1.5 text-rose-300 leading-relaxed">{cameraError}</p>
                {rawErrorDetail && (
                  <p className="text-[10px] font-mono text-text-muted mt-2 bg-black/40 px-2 py-1 rounded">
                    {rawErrorDetail}
                  </p>
                )}
              </div>

              {/* Action Buttons: Retry Camera & Upload Test Frame */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Test Photo
                </button>
              </div>

              <p className="text-[10px] text-text-muted mt-1">
                Tip: If other tabs named "Face Attendance" are open in your browser, close them so Windows releases the camera lock.
              </p>
            </div>
          ) : null}

          {/* Hidden File Input for Image Upload */}
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleUploadTestFrame} 
          />

          {/* Live Webcam Stream or Static Uploaded Image */}
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
                    startCamera();
                  }}
                  className="px-3 py-1 bg-black/75 hover:bg-black text-white text-[10px] font-semibold rounded-lg border border-white/20 flex items-center gap-1 shadow-lg"
                >
                  <Camera className="w-3 h-3 text-cyan-400" /> Switch to Live Camera
                </button>
              </div>
            </div>
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
          {(!cameraError || uploadedPreview) && (
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

          {/* Bottom Attendance Confirmation Toast Card */}
          {lastAttendanceNotice && (
            <div className={`absolute bottom-4 left-4 right-4 backdrop-blur-md text-white p-3.5 rounded-xl flex items-center justify-between z-30 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 border ${
              lastAttendanceNotice.status === 'Marked' 
                ? 'bg-emerald-950/95 border-emerald-500/50' 
                : 'bg-cyan-950/95 border-cyan-500/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                  lastAttendanceNotice.status === 'Marked'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                }`}>
                  {lastAttendanceNotice.status === 'Marked' ? <Check className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                </div>
                <div>
                  <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${
                    lastAttendanceNotice.status === 'Marked' ? 'text-emerald-400' : 'text-cyan-300'
                  }`}>
                    {lastAttendanceNotice.status === 'Marked' 
                      ? '✓ Attendance Marked Successfully' 
                      : 'Attendance Already Marked'}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {lastAttendanceNotice.name} <span className="font-mono text-cyan-300 font-normal">({lastAttendanceNotice.employee_id})</span>
                  </div>
                </div>
              </div>
              <div className="text-right border-l border-white/10 pl-4">
                <div className="text-[10px] text-white/60 uppercase font-medium">Recorded Time</div>
                <div className="text-xs font-mono font-bold text-cyan-300">{lastAttendanceNotice.check_in}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info & Telemetry */}
        <div className="px-6 py-3.5 bg-surface-hover/30 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">
              Anti-Spoofing: <strong className="text-white">Active</strong> &bull; Engine: <strong className="text-cyan-400">Facenox ArcFace 512d</strong> &bull; Timezone: <strong className="text-white">Asia/Kolkata (IST)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!cameraError && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Upload photo to test recognition"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" /> Test Photo
              </button>
            )}
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
