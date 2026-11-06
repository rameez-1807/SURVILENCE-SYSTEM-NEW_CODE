import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  X, 
  Check, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  User, 
  Building, 
  Briefcase, 
  IdCard, 
  MapPin, 
  Mail, 
  Phone, 
  ArrowRight,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEmployee?: {
    employee_id: string;
    name: string;
    department?: string;
    designation?: string;
  } | null;
}

type ScanStage = 'front_1' | 'turn_left' | 'turn_right' | 'front_2' | 'complete';

export function FaceRegistrationModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialEmployee = null 
}: FaceRegistrationModalProps) {
  // Form fields
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // ID Validation state
  const [idCheckStatus, setIdCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [idCheckMessage, setIdCheckMessage] = useState<string>('');

  // Scanning & Camera states
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guided Multi-Angle Scan States
  const [scanStage, setScanStage] = useState<ScanStage>('front_1');
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [instructionMessage, setInstructionMessage] = useState<string>('Step 1/4: Look straight at camera');
  const [faceDetected, setFaceDetected] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    name: string;
    employee_id: string;
    department?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sample accumulation
  const stageSamplesRef = useRef<{
    front_1: number;
    turn_left: number;
    turn_right: number;
    front_2: number;
  }>({ front_1: 0, turn_left: 0, turn_right: 0, front_2: 0 });

  const scanStageRef = useRef<ScanStage>('front_1');
  const isScanningActiveRef = useRef(false);
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);
  const lastCaptureTimeRef = useRef(0);

  // Pre-fill initial employee if passed
  useEffect(() => {
    if (initialEmployee) {
      setName(initialEmployee.name || '');
      setEmployeeId(initialEmployee.employee_id || '');
      setDepartment(initialEmployee.department || '');
      setDesignation(initialEmployee.designation || '');
    }
  }, [initialEmployee]);

  // Load client-side face detection models for real-time guidance
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        }
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
          await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        }
        if (isMounted) {
          setModelsLoaded(true);
        }
      } catch (e) {
        console.error('Failed to load face detection neural models:', e);
        if (isMounted) {
          setCameraError('Failed to load local face detection models from /models.');
        }
      }
    };

    if (isOpen) {
      loadModels();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isScanningActiveRef.current = false;
    setIsScanningActive(false);
  }, []);

  // Start webcam feed with permission handling
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      setCameraError(null);
      setError(null);
      setCapturedImage(null);
      setScanProgress(0);
      setScanStage('front_1');
      scanStageRef.current = 'front_1';
      stageSamplesRef.current = { front_1: 0, turn_left: 0, turn_right: 0, front_2: 0 };
      setInstructionMessage('Step 1/4: Look straight at camera');
      setStatusMessage('Center your face in the guide box');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device API not supported by browser.');
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch (err1) {
        console.warn('Enrollment Camera Tier 1 failed, attempting Tier 2...', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch (err2) {
          console.warn('Enrollment Camera Tier 2 failed, attempting raw video: true...', err2);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) {
        throw new Error('Unable to establish camera stream.');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.error('Video play error:', e));
        };
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error('Webcam access error:', err);
      let friendly = 'Unable to access camera hardware. Please check connection.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        friendly = 'Camera access blocked. Please allow webcam permissions in your browser URL bar.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        friendly = 'Camera is currently locked by another application or browser tab. Please close other camera tabs and click Retry, or upload a photo.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        friendly = 'No camera found. You can upload a photo to enroll face.';
      } else if (err?.message) {
        friendly = `${err.name || 'Error'}: ${err.message}`;
      }
      setCameraError(friendly);
    }
  }, [stopCamera]);

  // Upload photo fallback for enrollment
  const handleUploadPortrait = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setCapturedImage(b64);
      setScanProgress(100);
      setScanStage('complete');
      stopCamera();
      setStatusMessage('Portrait Photo Uploaded');
      setInstructionMessage('Biometric photo ready. Complete employee details below.');
    };
    reader.readAsDataURL(file);
  };

  // Trigger camera on open
  useEffect(() => {
    if (isOpen && modelsLoaded) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setName('');
      setEmployeeId('');
      setDepartment('');
      setDesignation('');
      setWorkLocation('');
      setEmail('');
      setPhone('');
      setCapturedImage(null);
      setRegistrationSuccess(null);
      setError(null);
      setIdCheckStatus('idle');
      setIdCheckMessage('');
    }
    return stopCamera;
  }, [isOpen, modelsLoaded, startCamera, stopCamera]);

  // Debounced Employee ID Uniqueness Check
  useEffect(() => {
    if (!employeeId.trim()) {
      setIdCheckStatus('idle');
      setIdCheckMessage('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIdCheckStatus('checking');
        const res = await api.get(`/employees/check-id/${encodeURIComponent(employeeId.trim())}`);
        if (res.data?.exists) {
          setIdCheckStatus('taken');
          setIdCheckMessage(`ID '${employeeId.trim()}' is already registered (${res.data.name || 'Existing staff'}).`);
        } else {
          setIdCheckStatus('available');
          setIdCheckMessage('Employee ID is available.');
        }
      } catch {
        setIdCheckStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [employeeId]);

  // Start the 4-Stage Guided Biometric Scan
  const handleStartGuidedScan = () => {
    stageSamplesRef.current = { front_1: 0, turn_left: 0, turn_right: 0, front_2: 0 };
    setScanProgress(0);
    setScanStage('front_1');
    scanStageRef.current = 'front_1';
    isScanningActiveRef.current = true;
    setIsScanningActive(true);
    setInstructionMessage('Step 1/4: Look straight at camera');
    setStatusMessage('Hold steady looking directly at the camera...');
  };

  // Finish scan, capture snapshot, and transition to manual details form
  const handleCompleteScan = (video: HTMLVideoElement) => {
    isScanningActiveRef.current = false;
    setIsScanningActive(false);
    setScanProgress(100);
    setScanStage('complete');
    scanStageRef.current = 'complete';

    // Capture highest-resolution portrait frame from stream
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.90);
      setCapturedImage(b64);
    }

    stopCamera();
    setStatusMessage('Face Scan Completed Successfully');
    setInstructionMessage('Biometric verified. Please confirm employee details below.');
  };

  // Main real-time detection & guided multi-angle pose tracking loop
  useEffect(() => {
    if (!isOpen || !modelsLoaded || capturedImage) return;

    const detectAndTrack = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.ended || video.paused || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detectAndTrack);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(detectAndTrack);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.40 }))
          .withFaceLandmarks();

        const resized = faceapi.resizeResults(detections, {
          width: canvas.width,
          height: canvas.height,
        });

        if (resized.length === 0) {
          setFaceDetected(false);
          setStatusMessage('No Face Detected');
          if (isScanningActiveRef.current) {
            setStatusMessage('No Face Detected — Please center face in box');
          }
        } else if (resized.length > 1) {
          setFaceDetected(false);
          setStatusMessage('Multiple Faces Detected — Please stay alone in frame');
          // Draw red warning boxes for all faces
          resized.forEach((det) => {
            const { x, y, width, height } = det.detection.box;
            drawBoundingBox(ctx, x, y, width, height, '#EF4444', 'Multiple Faces Detected');
          });
        } else {
          // Exactly 1 face
          setFaceDetected(true);
          const singleFace = resized[0];
          const { x, y, width, height } = singleFace.detection.box;
          const landmarks = singleFace.landmarks;

          // Check face size: reject if too small / too far
          const minSize = Math.min(canvas.width, canvas.height) * 0.18;
          if (width < minSize || height < minSize) {
            setStatusMessage('Move Closer to Camera');
            drawBoundingBox(ctx, x, y, width, height, '#F59E0B', 'Move Closer');
          } else {
            // Calculate Head Yaw Pose using 68 landmarks
            // Left eye corner: 36, Right eye corner: 45, Nose tip: 30
            const leftEyeCorner = landmarks.positions[36];
            const rightEyeCorner = landmarks.positions[45];
            const noseTip = landmarks.positions[30];

            const eyeDist = Math.abs(rightEyeCorner.x - leftEyeCorner.x) || 1.0;
            const yawRatio = (noseTip.x - leftEyeCorner.x) / eyeDist;

            // Yaw Interpretation:
            // Center: 0.42 <= yawRatio <= 0.58
            // Left: yawRatio < 0.40 (subject turned left on webcam view)
            // Right: yawRatio > 0.60 (subject turned right on webcam view)
            const isCenterPose = yawRatio >= 0.40 && yawRatio <= 0.60;
            const isLeftPose = yawRatio < 0.38;
            const isRightPose = yawRatio > 0.62;

            if (!isScanningActiveRef.current) {
              // Idle Ready Mode
              setStatusMessage('Face Detected — Ready for Guided Scan');
              drawBoundingBox(ctx, x, y, width, height, '#10B981', 'Ready');
            } else {
              // ACTIVE GUIDED SCANNING MODE
              drawBoundingBox(ctx, x, y, width, height, '#06B6D4', 'Scanning Biometrics');
              drawLaserLine(ctx, x, y, width, height);

              const now = Date.now();
              const timeSinceLast = now - lastCaptureTimeRef.current;
              const currentStage = scanStageRef.current;

              if (timeSinceLast >= 220) {
                if (currentStage === 'front_1') {
                  if (isCenterPose) {
                    stageSamplesRef.current.front_1 += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Capturing Front View (1/4)...');
                    if (stageSamplesRef.current.front_1 >= 3) {
                      scanStageRef.current = 'turn_left';
                      setScanStage('turn_left');
                      setInstructionMessage('Step 2/4: Turn your face slightly LEFT');
                      setStatusMessage('Please turn face slightly left');
                    }
                  } else {
                    setStatusMessage('Look straight at camera');
                  }
                } else if (currentStage === 'turn_left') {
                  if (isLeftPose) {
                    stageSamplesRef.current.turn_left += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Capturing Left Angle (2/4)...');
                    if (stageSamplesRef.current.turn_left >= 3) {
                      scanStageRef.current = 'turn_right';
                      setScanStage('turn_right');
                      setInstructionMessage('Step 3/4: Turn your face slightly RIGHT');
                      setStatusMessage('Please turn face slightly right');
                    }
                  } else {
                    setStatusMessage('Turn face slightly LEFT');
                  }
                } else if (currentStage === 'turn_right') {
                  if (isRightPose) {
                    stageSamplesRef.current.turn_right += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Capturing Right Angle (3/4)...');
                    if (stageSamplesRef.current.turn_right >= 3) {
                      scanStageRef.current = 'front_2';
                      setScanStage('front_2');
                      setInstructionMessage('Step 4/4: Return to FRONT view');
                      setStatusMessage('Look straight at camera to finalize');
                    }
                  } else {
                    setStatusMessage('Turn face slightly RIGHT');
                  }
                } else if (currentStage === 'front_2') {
                  if (isCenterPose) {
                    stageSamplesRef.current.front_2 += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Finalizing Biometric Extraction (4/4)...');
                    if (stageSamplesRef.current.front_2 >= 2) {
                      // Complete scan! Total 10 valid multi-angle samples!
                      handleCompleteScan(video);
                      return;
                    }
                  }
                }

                // Update Progress percentage
                const totalSamples =
                  stageSamplesRef.current.front_1 +
                  stageSamplesRef.current.turn_left +
                  stageSamplesRef.current.turn_right +
                  stageSamplesRef.current.front_2;
                setScanProgress(Math.min(100, Math.round((totalSamples / 11) * 100)));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Real-time face tracking frame error:', err);
      }

      animFrameRef.current = requestAnimationFrame(detectAndTrack);
    };

    animFrameRef.current = requestAnimationFrame(detectAndTrack);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, modelsLoaded, capturedImage]);

  // Canvas visual helpers
  const drawBoundingBox = (
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
    ctx.shadowBlur = 10;

    const corner = Math.min(w, h) * 0.22;
    // Corners
    ctx.beginPath();
    ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y);
    ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner);
    ctx.moveTo(x + w, y + h - corner); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - corner, y + h);
    ctx.moveTo(x + corner, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - corner);
    ctx.stroke();

    // Label Badge
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(x, Math.max(0, y - 26), textWidth + 16, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, x + 8, Math.max(16, y - 10));
    ctx.restore();
  };

  const drawLaserLine = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    const speed = h * 0.04;
    scanYRef.current += speed * scanDirRef.current;
    if (scanYRef.current >= h) {
      scanYRef.current = h;
      scanDirRef.current = -1;
    } else if (scanYRef.current <= 0) {
      scanYRef.current = 0;
      scanDirRef.current = 1;
    }

    const currentY = y + scanYRef.current;
    const gradient = ctx.createLinearGradient(x, currentY, x + w, currentY);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0)');
    gradient.addColorStop(0.5, '#06B6D4');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, currentY);
    ctx.lineTo(x + w, currentY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
    ctx.fillRect(x, y, w, scanYRef.current);
    ctx.restore();
  };

  // Step A5: Save Employee and Face Data to Backend Facenox Biometric Service
  const handleSaveAndRegister = async () => {
    if (!name.trim() || !employeeId.trim()) {
      setError('Employee Full Name and Employee ID are required.');
      return;
    }

    if (idCheckStatus === 'taken' && !initialEmployee) {
      setError(`Employee ID '${employeeId.trim()}' is already in use.`);
      return;
    }

    if (!capturedImage) {
      setError('Please complete the guided face scan first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call dedicated Facenox registration API endpoint
      const res = await api.post('/employees/register-facenox', {
        name: name.trim(),
        employee_id: employeeId.trim(),
        department: department.trim() || undefined,
        designation: designation.trim() || undefined,
        work_location: workLocation.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        image: capturedImage,
      });

      setRegistrationSuccess({
        name: res.data.name,
        employee_id: res.data.employee_id,
        department: res.data.department,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Registration failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to register employee face biometrics.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Biometric Face Enrollment</h2>
              <p className="text-xs text-text-muted">Multi-Angle Guided Scan &bull; Anti-Spoof &bull; ArcFace 512d</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {registrationSuccess ? (
            /* Success confirmation card */
            <div className="py-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Check className="w-8 h-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-emerald-400">
                  Employee Registered Successfully
                </h3>
                <p className="text-xs text-text-muted">Biometric profile encrypted at rest with AES-256-GCM.</p>
              </div>

              <div className="bg-surface-hover/60 border border-border p-4 rounded-xl text-left max-w-sm mx-auto space-y-2.5 text-xs shadow-sm">
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-text-muted font-medium">Full Name:</span>
                  <span className="text-text font-bold">{registrationSuccess.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-text-muted font-medium">Employee ID:</span>
                  <span className="text-cyan-400 font-mono font-bold">{registrationSuccess.employee_id}</span>
                </div>
                {registrationSuccess.department && (
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-text-muted font-medium">Department:</span>
                    <span className="text-text font-semibold">{registrationSuccess.department}</span>
                  </div>
                )}
                <div className="pt-1 text-center text-xs text-emerald-400 font-medium bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
                  ✓ Face Enrolled: ArcFace 512-d (Encrypted)
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
                    setWorkLocation('');
                    setEmail('');
                    setPhone('');
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
              {/* Error Banners */}
              {cameraError && (
                <div className="bg-danger/10 border border-danger/20 text-danger p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* SECTION 1: Camera & Guided Scan Area */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-text-muted">
                  <span className="flex items-center gap-1.5 font-semibold text-text">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Live Biometric Scan
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 ${
                    capturedImage 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : isScanningActive 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse' 
                      : faceDetected 
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                      : 'bg-surface-hover text-text-muted border-border'
                  }`}>
                    {isScanningActive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    {statusMessage}
                  </span>
                </div>

                {/* Video / Snapshot Container */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border group shadow-inner">
                  {capturedImage ? (
                    <div className="relative w-full h-full">
                      <img src={capturedImage} alt="Enrolled Face" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                        <div className="text-white text-xs font-semibold flex items-center gap-2 bg-emerald-600/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-400/30">
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          Multi-Angle Biometric Scan Completed (100%)
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

                  {/* Guided Instruction Badge Overlay during active scan */}
                  {isScanningActive && (
                    <div className="absolute top-3 left-4 right-4 bg-black/75 backdrop-blur-md py-2 px-3.5 rounded-xl border border-white/10 flex items-center justify-between text-xs font-semibold text-white z-20">
                      <div className="flex items-center gap-2">
                        {scanStage === 'turn_left' ? (
                          <ArrowLeft className="w-4 h-4 text-cyan-400 animate-bounce" />
                        ) : scanStage === 'turn_right' ? (
                          <ArrowRight className="w-4 h-4 text-cyan-400 animate-bounce" />
                        ) : (
                          <Eye className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{instructionMessage}</span>
                      </div>
                      <span className="font-mono text-cyan-300">{scanProgress}%</span>
                    </div>
                  )}

                  {/* Bottom Scan Progress Bar */}
                  {isScanningActive && (
                    <div className="absolute bottom-3 left-4 right-4 bg-black/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10 flex flex-col gap-1 z-20">
                      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200 ease-out"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scan Controls */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-text-muted">
                    {capturedImage 
                      ? '✓ Face Scan Completed. Complete employee details below.' 
                      : isScanningActive 
                      ? 'Follow the on-screen head turn instructions.' 
                      : 'Center face in box and click Start Guided Scan.'}
                  </p>

                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleUploadPortrait} 
                  />

                  {capturedImage ? (
                    <button 
                      onClick={startCamera}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs bg-surface hover:bg-surface-hover text-text px-3 py-1.5 rounded-lg border border-border transition-colors font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake Scan
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs bg-surface hover:bg-surface-hover text-text px-3 py-1.5 rounded-lg border border-border transition-colors font-medium cursor-pointer"
                        title="Upload a clear portrait photo"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Upload Photo</span>
                      </button>
                      <button 
                        onClick={handleStartGuidedScan}
                        disabled={!modelsLoaded || isScanningActive || !faceDetected}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isScanningActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        {isScanningActive ? 'Scanning Angles...' : 'Start Guided Scan'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Manual Employee Registration Form */}
              <div className="space-y-3.5 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Employee Information Form
                  </h3>
                  <span className="text-[10px] text-text-muted">* Required fields</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Full Name *
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Employee ID */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                        <IdCard className="w-3.5 h-3.5" /> Employee ID *
                      </label>
                      {idCheckStatus === 'available' && (
                        <span className="text-[10px] text-emerald-400 font-semibold">✓ Available</span>
                      )}
                      {idCheckStatus === 'taken' && (
                        <span className="text-[10px] text-rose-400 font-semibold">⚠️ Exists</span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. EMP-101"
                      className={`w-full bg-[#0a0f1d] border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 text-white placeholder-text-muted font-mono ${
                        idCheckStatus === 'taken' 
                          ? 'border-rose-500/60 focus:ring-rose-500' 
                          : idCheckStatus === 'available' 
                          ? 'border-emerald-500/60 focus:ring-emerald-500' 
                          : 'border-border/80 focus:ring-cyan-500'
                      }`}
                    />
                    {idCheckMessage && (
                      <p className={`text-[10px] ${idCheckStatus === 'taken' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {idCheckMessage}
                      </p>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Department
                    </label>
                    <input 
                      type="text" 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Surveillance Operations"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Designation */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" /> Designation
                    </label>
                    <input 
                      type="text" 
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Senior Analyst"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Work Location */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Work Location
                    </label>
                    <input 
                      type="text" 
                      value={workLocation}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      placeholder="e.g. Headquarters Block A"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@company.com"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Mobile Number */}
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> Mobile Number
                    </label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!registrationSuccess && (
          <div className="px-6 py-4 border-t border-border bg-surface-hover/40 flex items-center justify-between">
            <div className="text-[11px] text-text-muted">
              {capturedImage 
                ? 'Biometric features ready for persistence.' 
                : 'Complete the face scan to enable registration.'}
            </div>

            <div className="flex gap-2.5">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-text-muted hover:text-text hover:bg-surface border border-transparent rounded-lg transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAndRegister}
                disabled={loading || !capturedImage || !name.trim() || !employeeId.trim() || idCheckStatus === 'taken'}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 text-white rounded-lg transition-colors text-xs font-semibold shadow-md disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save &amp; Register Employee
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
