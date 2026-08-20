import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Loader2, RefreshCw, AlertTriangle, ShieldCheck, User, Building, Briefcase, IdCard } from 'lucide-react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DetectionStatus = 
  | 'idle'
  | 'detecting'
  | 'no_face'
  | 'multiple_faces'
  | 'face_too_far'
  | 'face_detected'
  | 'scanning'
  | 'capturing'
  | 'processing'
  | 'complete';

export function FaceRegistrationModal({ isOpen, onClose, onSuccess }: FaceRegistrationModalProps) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [embedding, setEmbedding] = useState<number[] | null>(null);

  // Scan & Detection States
  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [scanProgress, setScanProgress] = useState(0);
  const [samplesCount, setSamplesCount] = useState(0);
  const TARGET_SAMPLES = 10;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const isScanningRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1); // 1 = down, -1 = up

  // Load face-api models on modal open
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        if (isMounted) {
          setModelsLoaded(true);
        }
      } catch (e) {
        console.error("Error loading face-api models", e);
        if (isMounted) {
          setError("Failed to load AI face models from /models.");
        }
      }
    };
    if (isOpen && !modelsLoaded) {
      loadModels();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, modelsLoaded]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    isScanningRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;

      // Reset internal states
      setCapturedImage(null);
      setEmbedding(null);
      setError(null);
      setScanProgress(0);
      setSamplesCount(0);
      samplesRef.current = [];
      isScanningRef.current = false;
      setStatus('detecting');
      setStatusMessage('Detecting face...');
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please allow webcam permissions.');
      setStatus('idle');
    }
  }, [stopCamera]);

  // Clean up states when modal closes/opens
  useEffect(() => {
    if (isOpen && modelsLoaded) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setName('');
      setEmployeeId('');
      setDepartment('');
      setDesignation('');
      setCapturedImage(null);
      setEmbedding(null);
      setError(null);
      setStatus('idle');
      setScanProgress(0);
      setSamplesCount(0);
      samplesRef.current = [];
      isScanningRef.current = false;
    }
    return stopCamera;
  }, [isOpen, modelsLoaded, startCamera, stopCamera]);

  // Main Detection and Canvas Rendering Loop
  useEffect(() => {
    if (!isOpen || !modelsLoaded || capturedImage) return;

    let lastSampleTime = 0;

    const detectAndDraw = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.paused || video.ended || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detectAndDraw);
        return;
      }

      // Match canvas dimensions to video size
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(detectAndDraw);
        return;
      }

      // Clear previous overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        // Detect all faces for validation
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        if (!isScanningRef.current) {
          // --- REAL-TIME DETECTION MODE ---
          if (resizedDetections.length === 0) {
            setStatus('no_face');
            setStatusMessage('No face detected');
          } else if (resizedDetections.length > 1) {
            setStatus('multiple_faces');
            setStatusMessage('Multiple faces detected');

            // Draw red warning boxes for all detected faces
            resizedDetections.forEach(det => {
              const { x, y, width, height } = det.detection.box;
              drawGuideBox(ctx, x, y, width, height, '#EF4444', 'Multiple Faces');
            });
          } else {
            const singleFace = resizedDetections[0];
            const { x, y, width, height } = singleFace.detection.box;

            // Check if face is too small / too far
            const minSizeThreshold = Math.min(canvas.width, canvas.height) * 0.22;
            if (width < minSizeThreshold || height < minSizeThreshold) {
              setStatus('face_too_far');
              setStatusMessage('Face too far');
              drawGuideBox(ctx, x, y, width, height, '#F59E0B', 'Face Too Far');
            } else {
              setStatus('face_detected');
              setStatusMessage('Face detected');
              drawGuideBox(ctx, x, y, width, height, '#10B981', 'Ready for Scan');
            }
          }
        } else {
          // --- ACTIVE SCANNING MODE ---
          if (resizedDetections.length === 0) {
            setStatus('no_face');
            setStatusMessage('No face detected - Pause scanning');
          } else if (resizedDetections.length > 1) {
            setStatus('multiple_faces');
            setStatusMessage('Multiple faces detected - Please stay alone in frame');
          } else {
            const singleFace = resizedDetections[0];
            const { x, y, width, height } = singleFace.detection.box;

            const minSizeThreshold = Math.min(canvas.width, canvas.height) * 0.22;
            if (width < minSizeThreshold || height < minSizeThreshold) {
              setStatus('face_too_far');
              setStatusMessage('Face too far - Move closer');
              drawGuideBox(ctx, x, y, width, height, '#F59E0B', 'Too Far');
            } else {
              // Valid single face for sample collection!
              setStatus('capturing');
              setStatusMessage(`Capturing samples... (${samplesRef.current.length}/${TARGET_SAMPLES})`);

              // Draw green bounding box
              drawGuideBox(ctx, x, y, width, height, '#10B981', `Scanning ${Math.round((samplesRef.current.length / TARGET_SAMPLES) * 100)}%`);

              // Draw animated laser scan line
              drawLaserScanLine(ctx, x, y, width, height);

              // Collect sample frame every 250ms
              const now = Date.now();
              if (now - lastSampleTime > 250) {
                lastSampleTime = now;
                samplesRef.current.push(singleFace.descriptor);
                setSamplesCount(samplesRef.current.length);
                const currentProg = Math.round((samplesRef.current.length / TARGET_SAMPLES) * 100);
                setScanProgress(currentProg);

                // Check if all samples collected
                if (samplesRef.current.length >= TARGET_SAMPLES) {
                  isScanningRef.current = false;
                  setStatus('processing');
                  setStatusMessage('Processing face descriptors...');

                  // Process averaged descriptor
                  finishScanning(video);
                  return;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Detection error:", err);
      }

      animFrameRef.current = requestAnimationFrame(detectAndDraw);
    };

    animFrameRef.current = requestAnimationFrame(detectAndDraw);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, modelsLoaded, capturedImage]);

  // Draw stylish corner bounding box on canvas
  const drawGuideBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    label: string
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    const cornerLength = Math.min(w, h) * 0.2;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLength, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLength);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - cornerLength);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - cornerLength, y + h);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x + cornerLength, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - cornerLength);
    ctx.stroke();

    // Badge label
    ctx.fillStyle = color;
    ctx.font = '600 12px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(x, Math.max(0, y - 24), textWidth + 16, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, x + 8, Math.max(15, y - 9));

    ctx.restore();
  };

  // Draw moving animated laser scan line inside face bounding box
  const drawLaserScanLine = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    ctx.save();
    
    // Update vertical scan line position
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

    // Glowing laser gradient line
    const gradient = ctx.createLinearGradient(x, currentY, x + w, currentY);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
    gradient.addColorStop(0.2, 'rgba(16, 185, 129, 0.8)');
    gradient.addColorStop(0.5, 'rgba(52, 211, 153, 1)');
    gradient.addColorStop(0.8, 'rgba(16, 185, 129, 0.8)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(x, currentY);
    ctx.lineTo(x + w, currentY);
    ctx.stroke();

    // Light scan shade area behind line
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(x, y, w, scanYRef.current);

    ctx.restore();
  };

  // Start 360 Multi-sample Scan process
  const startScanning = () => {
    if (!modelsLoaded || status === 'no_face' || status === 'multiple_faces' || status === 'face_too_far') {
      return;
    }
    setError(null);
    samplesRef.current = [];
    setSamplesCount(0);
    setScanProgress(0);
    scanYRef.current = 0;
    scanDirRef.current = 1;
    isScanningRef.current = true;
    setStatus('scanning');
    setStatusMessage('Scanning...');
  };

  // Calculate averaged 128-d descriptor and capture snapshot
  const finishScanning = (video: HTMLVideoElement) => {
    const samples = samplesRef.current;
    if (samples.length === 0) {
      setError("No face samples captured. Please try scanning again.");
      setStatus('detecting');
      isScanningRef.current = false;
      return;
    }

    // Compute element-wise mean descriptor array across all captured samples
    const avg = new Array(128).fill(0);
    samples.forEach(descriptor => {
      for (let i = 0; i < 128; i++) {
        avg[i] += descriptor[i];
      }
    });
    for (let i = 0; i < 128; i++) {
      avg[i] /= samples.length;
    }

    // L2 Vector Normalization onto unit hypersphere
    let normSq = 0;
    for (let i = 0; i < 128; i++) {
      normSq += avg[i] * avg[i];
    }
    const norm = Math.sqrt(normSq) || 1.0;
    for (let i = 0; i < 128; i++) {
      avg[i] /= norm;
    }

    setEmbedding(avg);

    // Capture thumbnail image from video stream
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    }

    stopCamera();
    setStatus('complete');
    setStatusMessage('Registration complete');
    setScanProgress(100);
  };

  const [registrationSuccess, setRegistrationSuccess] = useState<{ name: string; employee_id: string } | null>(null);

  const retakeScan = () => {
    startCamera();
  };

  // Send registration request to backend API
  const handleRegister = async () => {
    if (!name || !employeeId || !embedding) {
      setError('Please enter Full Name, Employee ID, and complete face scan.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await api.post('/employees/register', {
        name,
        employee_id: employeeId,
        department: department || undefined,
        designation: designation || undefined,
        face_encoding: embedding
      });

      setRegistrationSuccess({
        name: res.data.name,
        employee_id: res.data.employee_id
      });
      onSuccess();
    } catch (err: any) {
      console.error('Registration API error:', err);
      setError(err.response?.data?.detail || 'Failed to register employee face.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Status Badge styling helper
  const getStatusBadge = () => {
    switch (status) {
      case 'complete':
        return 'bg-success/20 text-success border-success/30';
      case 'capturing':
      case 'scanning':
        return 'bg-primary/20 text-primary border-primary/30 animate-pulse';
      case 'face_detected':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'no_face':
      case 'multiple_faces':
        return 'bg-danger/20 text-danger border-danger/30';
      case 'face_too_far':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-surface-hover text-text-muted border-border';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Biometric Face Registration</h2>
              <p className="text-xs text-text-muted">Register employee facial biometric descriptor</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {registrationSuccess ? (
          <div className="p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-success/20 border border-success/40 text-success rounded-full flex items-center justify-center mx-auto shadow-lg shadow-success/10">
              <Check className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-success flex items-center justify-center gap-1.5">
                ✓ Face Registered Successfully
              </h3>
              <p className="text-xs text-text-muted">Biometric facial profile created and stored.</p>
            </div>

            <div className="bg-surface-hover/60 border border-border p-4 rounded-xl text-left max-w-sm mx-auto space-y-2.5 text-sm shadow-sm">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-text-muted font-medium text-xs">Name:</span>
                <span className="text-text font-bold">{registrationSuccess.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-text-muted font-medium text-xs">Employee ID:</span>
                <span className="text-primary font-mono font-bold">{registrationSuccess.employee_id}</span>
              </div>
              <div className="pt-1 text-center text-xs text-emerald-400 font-medium bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
                Face profile saved permanently.
              </div>
            </div>

            <div className="pt-3 flex justify-center gap-3">
              <button
                onClick={() => {
                  setRegistrationSuccess(null);
                  setName('');
                  setEmployeeId('');
                  setDepartment('');
                  setDesignation('');
                  startCamera();
                }}
                className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-semibold transition-colors"
              >
                Register Another
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {!modelsLoaded && !error && (
                <div className="flex items-center gap-2.5 text-text-muted bg-surface border border-border p-3.5 rounded-xl text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Loading neural network face models...
                </div>
              )}

              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger p-3.5 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Camera Feed & Canvas Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-text-muted">
                  <span>Webcam Live Feed</span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${getStatusBadge()}`}>
                    {status === 'capturing' || status === 'scanning' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : status === 'complete' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-current" />
                    )}
                    {statusMessage}
                  </span>
                </div>

                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border group shadow-inner">
                  {capturedImage ? (
                    <div className="relative w-full h-full">
                      <img src={capturedImage} alt="Captured face thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                        <div className="text-white text-xs font-medium flex items-center gap-2 bg-success/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-success/40">
                          <Check className="w-4 h-4 text-success" /> 10 Samples Captured & Averaged
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />
                      <canvas 
                        ref={canvasRef} 
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />
                    </>
                  )}

                  {/* Progress bar overlay during scan */}
                  {(isScanningRef.current || status === 'capturing' || status === 'scanning') && (
                    <div className="absolute bottom-3 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 flex flex-col gap-1.5 z-20">
                      <div className="flex justify-between text-xs font-semibold text-white">
                        <span>Capturing Face Biometrics</span>
                        <span>{scanProgress}% ({samplesCount}/{TARGET_SAMPLES})</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-200 ease-out"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scan Action Controls */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-text-muted">
                    {status === 'complete' 
                      ? 'Face scan complete. Fill employee details below.'
                      : 'Center face in camera box and click Start Scan.'}
                  </p>

                  {capturedImage ? (
                    <button 
                      onClick={retakeScan}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs bg-surface hover:bg-surface-hover text-text px-3.5 py-1.5 rounded-lg border border-border transition-colors font-medium"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Rescan Face
                    </button>
                  ) : (
                    <button 
                      onClick={startScanning}
                      disabled={!modelsLoaded || isScanningRef.current || status === 'no_face' || status === 'multiple_faces' || status === 'face_too_far'}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium text-xs shadow-md transition-all disabled:cursor-not-allowed"
                    >
                      {isScanningRef.current ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {isScanningRef.current ? 'Scanning...' : 'Start 360 Scan'}
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields Section */}
              <div className="space-y-3.5 pt-2 border-t border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Employee Profile Details</h3>
                
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Full Name *
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <IdCard className="w-3.5 h-3.5" /> Employee ID *
                    </label>
                    <input 
                      type="text" 
                      value={employeeId}
                      onChange={e => setEmployeeId(e.target.value)}
                      placeholder="e.g. EMP-101"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Department
                    </label>
                    <input 
                      type="text" 
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" /> Designation
                    </label>
                    <input 
                      type="text" 
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      placeholder="e.g. Senior Developer"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-border bg-surface-hover/40 flex justify-end gap-2.5">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-text-muted hover:text-text hover:bg-surface border border-transparent rounded-lg transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={handleRegister}
                disabled={loading || !embedding || !name.trim() || !employeeId.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg transition-colors text-xs font-semibold shadow-md disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Register Employee
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
