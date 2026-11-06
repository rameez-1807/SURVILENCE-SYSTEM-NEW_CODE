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
  Upload,
  Cpu,
  CameraOff
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
  // Camera Mode: 'hardware' (DirectShow OpenCV backend) or 'browser' (HTML5 WebRTC)
  const [cameraMode, setCameraMode] = useState<'hardware' | 'browser'>('hardware');

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
  const [hardwareFrame, setHardwareFrame] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guided Multi-Angle Scan States
  const [scanStage, setScanStage] = useState<ScanStage>('front_1');
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [instructionMessage, setInstructionMessage] = useState<string>('Look straight at camera');
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
  const hardwarePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  // Sample accumulation for guided scan
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
  const hardwareFacesRef = useRef<any[]>([]);

  // Pre-fill initial employee if passed
  useEffect(() => {
    if (initialEmployee) {
      setName(initialEmployee.name || '');
      setEmployeeId(initialEmployee.employee_id || '');
      setDepartment(initialEmployee.department || '');
      setDesignation(initialEmployee.designation || '');
    }
  }, [initialEmployee]);

  // Load client-side face detection models for real-time guidance (browser mode)
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
        console.warn('Face-api client models not loaded:', e);
      }
    };

    if (isOpen) {
      loadModels();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Stop browser camera stream safely
  const stopBrowserCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Stop hardware polling loop
  const stopHardwarePolling = useCallback(() => {
    if (hardwarePollRef.current) {
      clearInterval(hardwarePollRef.current);
      hardwarePollRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Start webcam feed with progressive fallback (Browser Mode)
  const startBrowserCamera = useCallback(async () => {
    try {
      stopBrowserCamera();
      stopHardwarePolling();
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
          video: true,
          audio: false,
        });
      } catch (err1) {
        console.warn('Browser raw video:true failed, trying user facingMode...', err1);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
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
      console.warn('Browser webcam access error:', err);
      let friendly = 'Browser webcam blocked or unavailable. Switch to Direct USB WebCam mode below.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        friendly = 'Camera permission blocked. Please allow webcam in Chrome URL bar, or click Direct USB WebCam.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        friendly = 'Browser could not find camera device. Switch to Direct USB WebCam (Recommended).';
      }
      setCameraError(friendly);
    }
  }, [stopBrowserCamera, stopHardwarePolling]);

  // Polling loop for Native Hardware WebCam (DirectShow)
  const pollHardwareEnrollment = useCallback(async () => {
    if (isPollingRef.current) return;
    try {
      isPollingRef.current = true;
      const res = await api.post('/attendance/hardware-webcam/scan', {});
      if (res.data?.success) {
        setCameraError(null);
        if (res.data.frame) {
          setHardwareFrame(res.data.frame);
        }

        const faces = res.data.faces || [];
        hardwareFacesRef.current = faces;

        if (faces.length === 1) {
          setFaceDetected(true);
          const f = faces[0];
          const conf = Math.round((f.confidence || 0.95) * 100);
          setStatusMessage(`Face Detected (${conf}%)`);
          setInstructionMessage('Face centered! Click "Capture Face" or start guided scan.');

          // If guided scanning is active in hardware mode, progress stages
          if (isScanningActiveRef.current) {
            const now = Date.now();
            if (now - lastCaptureTimeRef.current >= 260) {
              lastCaptureTimeRef.current = now;
              const cur = scanStageRef.current;
              if (cur === 'front_1') {
                stageSamplesRef.current.front_1 += 1;
                setScanProgress(25);
                if (stageSamplesRef.current.front_1 >= 2) {
                  scanStageRef.current = 'turn_left';
                  setScanStage('turn_left');
                  setInstructionMessage('Step 2/4: Turn face slightly LEFT');
                }
              } else if (cur === 'turn_left') {
                stageSamplesRef.current.turn_left += 1;
                setScanProgress(50);
                if (stageSamplesRef.current.turn_left >= 2) {
                  scanStageRef.current = 'turn_right';
                  setScanStage('turn_right');
                  setInstructionMessage('Step 3/4: Turn face slightly RIGHT');
                }
              } else if (cur === 'turn_right') {
                stageSamplesRef.current.turn_right += 1;
                setScanProgress(75);
                if (stageSamplesRef.current.turn_right >= 2) {
                  scanStageRef.current = 'front_2';
                  setScanStage('front_2');
                  setInstructionMessage('Step 4/4: Look straight to finish');
                }
              } else if (cur === 'front_2') {
                stageSamplesRef.current.front_2 += 1;
                setScanProgress(100);
                if (stageSamplesRef.current.front_2 >= 2) {
                  // Complete
                  isScanningActiveRef.current = false;
                  setIsScanningActive(false);
                  setScanStage('complete');
                  scanStageRef.current = 'complete';
                  if (res.data.frame) {
                    setCapturedImage(res.data.frame);
                  }
                  stopHardwarePolling();
                  setStatusMessage('Face Scan Completed Successfully');
                  setInstructionMessage('Biometric verified. Please confirm employee details below.');
                }
              }
            }
          }
        } else if (faces.length > 1) {
          setFaceDetected(false);
          setStatusMessage('Multiple Faces Detected — Only 1 person permitted');
          setInstructionMessage('Please ensure only the employee is visible.');
        } else {
          setFaceDetected(false);
          setStatusMessage('Looking for human face...');
          setInstructionMessage('Center your face in front of the camera.');
        }
      } else if (res.data?.error) {
        setCameraError(res.data.error);
      }
    } catch (err: any) {
      console.warn('Hardware webcam polling error:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [stopHardwarePolling]);

  // Capture current frame from hardware webcam instantly
  const handleCaptureInstantHardware = useCallback(() => {
    if (hardwareFrame) {
      setCapturedImage(hardwareFrame);
      setScanProgress(100);
      setScanStage('complete');
      scanStageRef.current = 'complete';
      isScanningActiveRef.current = false;
      setIsScanningActive(false);
      stopHardwarePolling();
      setStatusMessage('Face Captured from USB WebCam');
      setInstructionMessage('Biometric photo ready. Complete employee details below.');
    }
  }, [hardwareFrame, stopHardwarePolling]);

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
      stopBrowserCamera();
      stopHardwarePolling();
      setStatusMessage('Portrait Photo Uploaded');
      setInstructionMessage('Biometric photo ready. Complete employee details below.');
    };
    reader.readAsDataURL(file);
  };

  // Main lifecycle for camera modes
  useEffect(() => {
    if (!isOpen) {
      stopBrowserCamera();
      stopHardwarePolling();
      setName('');
      setEmployeeId('');
      setDepartment('');
      setDesignation('');
      setWorkLocation('');
      setEmail('');
      setPhone('');
      setCapturedImage(null);
      setHardwareFrame(null);
      setRegistrationSuccess(null);
      setError(null);
      setCameraError(null);
      setIdCheckStatus('idle');
      setIdCheckMessage('');
      isScanningActiveRef.current = false;
      setIsScanningActive(false);
      return;
    }

    if (capturedImage) {
      stopBrowserCamera();
      stopHardwarePolling();
      return;
    }

    if (cameraMode === 'hardware') {
      stopBrowserCamera();
      void pollHardwareEnrollment();
      const interval = setInterval(() => {
        void pollHardwareEnrollment();
      }, 260);
      hardwarePollRef.current = interval;
      return () => {
        clearInterval(interval);
        hardwarePollRef.current = null;
      };
    } else {
      stopHardwarePolling();
      void startBrowserCamera();
      return stopBrowserCamera;
    }
  }, [isOpen, cameraMode, capturedImage, pollHardwareEnrollment, startBrowserCamera, stopBrowserCamera, stopHardwarePolling]);

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

  // Finish scan in browser mode, capture snapshot, and transition to manual details form
  const handleCompleteBrowserScan = (video: HTMLVideoElement) => {
    isScanningActiveRef.current = false;
    setIsScanningActive(false);
    setScanProgress(100);
    setScanStage('complete');
    scanStageRef.current = 'complete';

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.90);
      setCapturedImage(b64);
    }

    stopBrowserCamera();
    setStatusMessage('Face Scan Completed Successfully');
    setInstructionMessage('Biometric verified. Please confirm employee details below.');
  };

  // Browser FaceAPI tracking loop
  useEffect(() => {
    if (!isOpen || cameraMode !== 'browser' || !modelsLoaded || capturedImage) return;

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
        } else if (resized.length > 1) {
          setFaceDetected(false);
          setStatusMessage('Multiple Faces Detected — Stay alone');
          resized.forEach((det) => {
            const { x, y, width, height } = det.detection.box;
            drawBoundingBox(ctx, x, y, width, height, '#EF4444', 'Multiple Faces');
          });
        } else {
          setFaceDetected(true);
          const singleFace = resized[0];
          const { x, y, width, height } = singleFace.detection.box;
          const landmarks = singleFace.landmarks;

          const minSize = Math.min(canvas.width, canvas.height) * 0.18;
          if (width < minSize || height < minSize) {
            setStatusMessage('Move Closer to Camera');
            drawBoundingBox(ctx, x, y, width, height, '#F59E0B', 'Move Closer');
          } else {
            const leftEyeCorner = landmarks.positions[36];
            const rightEyeCorner = landmarks.positions[45];
            const noseTip = landmarks.positions[30];

            const eyeDist = Math.abs(rightEyeCorner.x - leftEyeCorner.x) || 1.0;
            const yawRatio = (noseTip.x - leftEyeCorner.x) / eyeDist;

            const isCenterPose = yawRatio >= 0.40 && yawRatio <= 0.60;
            const isLeftPose = yawRatio < 0.38;
            const isRightPose = yawRatio > 0.62;

            if (!isScanningActiveRef.current) {
              setStatusMessage('Face Detected — Ready for Guided Scan');
              drawBoundingBox(ctx, x, y, width, height, '#10B981', 'Ready');
            } else {
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
                      setInstructionMessage('Step 2/4: Turn face slightly LEFT');
                    }
                  }
                } else if (currentStage === 'turn_left') {
                  if (isLeftPose) {
                    stageSamplesRef.current.turn_left += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Capturing Left Angle (2/4)...');
                    if (stageSamplesRef.current.turn_left >= 2) {
                      scanStageRef.current = 'turn_right';
                      setScanStage('turn_right');
                      setInstructionMessage('Step 3/4: Turn face slightly RIGHT');
                    }
                  }
                } else if (currentStage === 'turn_right') {
                  if (isRightPose) {
                    stageSamplesRef.current.turn_right += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Capturing Right Angle (3/4)...');
                    if (stageSamplesRef.current.turn_right >= 2) {
                      scanStageRef.current = 'front_2';
                      setScanStage('front_2');
                      setInstructionMessage('Step 4/4: Look straight at camera');
                    }
                  }
                } else if (currentStage === 'front_2') {
                  if (isCenterPose) {
                    stageSamplesRef.current.front_2 += 1;
                    lastCaptureTimeRef.current = now;
                    setStatusMessage('Final Validation (4/4)...');
                    if (stageSamplesRef.current.front_2 >= 3) {
                      handleCompleteBrowserScan(video);
                      return;
                    }
                  }
                }

                const total = 
                  stageSamplesRef.current.front_1 + 
                  stageSamplesRef.current.turn_left + 
                  stageSamplesRef.current.turn_right + 
                  stageSamplesRef.current.front_2;
                setScanProgress(Math.min(100, Math.round((total / 10) * 100)));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Browser face detection error:', err);
      }

      animFrameRef.current = requestAnimationFrame(detectAndTrack);
    };

    animFrameRef.current = requestAnimationFrame(detectAndTrack);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, cameraMode, modelsLoaded, capturedImage]);

  // Hardware Canvas Overlay Renderer
  useEffect(() => {
    if (cameraMode !== 'hardware' || !isOpen || capturedImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const faces = hardwareFacesRef.current;
    if (faces.length === 1) {
      const b = faces[0].bbox;
      const stroke = faces[0].liveness?.is_real ? '#10B981' : '#EF4444';
      const label = faces[0].liveness?.is_real ? 'Face Detected' : 'Anti-Spoof Alert';
      drawBoundingBox(ctx, b.x, b.y, b.width, b.height, stroke, label);
      if (isScanningActiveRef.current) {
        drawLaserLine(ctx, b.x, b.y, b.width, b.height);
      }
    } else if (faces.length > 1) {
      faces.forEach((f) => {
        const b = f.bbox;
        drawBoundingBox(ctx, b.x, b.y, b.width, b.height, '#EF4444', 'Multiple Faces');
      });
    }
  });

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
    ctx.beginPath();
    ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y);
    ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner);
    ctx.moveTo(x + w, y + h - corner); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - corner, y + h);
    ctx.moveTo(x + corner, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - corner);
    ctx.stroke();

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
      setError('Please capture or upload a face photo first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
        
        {/* Header with Camera Mode Selector */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Biometric Face Enrollment</h2>
              <p className="text-xs text-text-muted">YuNet &bull; Multi-Angle &bull; Anti-Spoof &bull; ArcFace 512d</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Camera Mode Toggle */}
            <div className="flex items-center bg-[#0a0f1d] p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => {
                  setCameraMode('hardware');
                  setCameraError(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                  cameraMode === 'hardware'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
                title="DirectShow Native Hardware WebCam (Bypasses Browser Security Barriers)"
              >
                <Cpu className="w-3 h-3 text-cyan-300" />
                <span>Direct USB WebCam</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraMode('browser');
                  setCameraError(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                  cameraMode === 'browser'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Browser WebRTC Media Stream"
              >
                <Camera className="w-3 h-3 text-cyan-300" />
                <span>Browser Cam</span>
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
                  ✓ Face Enrolled: ArcFace 512-d (Encrypted AES-GCM)
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
                    setCapturedImage(null);
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
                <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-xl text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                  {cameraMode === 'browser' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraMode('hardware');
                        setCameraError(null);
                      }}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold whitespace-nowrap"
                    >
                      Use USB WebCam
                    </button>
                  )}
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
                    <span className="text-[10px] text-text-muted font-normal">
                      ({cameraMode === 'hardware' ? 'USB DirectShow' : 'Browser WebRTC'})
                    </span>
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
                          Face Photo Confirmed (100%)
                        </div>
                      </div>
                    </div>
                  ) : cameraMode === 'hardware' ? (
                    hardwareFrame ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={hardwareFrame} 
                          alt="Hardware Live WebCam" 
                          className="w-full h-full object-cover" 
                        />
                        <canvas 
                          ref={canvasRef} 
                          className="absolute inset-0 w-full h-full pointer-events-none" 
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                        <span>Connecting to USB WebCam...</span>
                      </div>
                    )
                  ) : cameraMode === 'browser' && cameraError ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
                      <CameraOff className="w-10 h-10 text-rose-400" />
                      <p className="text-xs text-rose-300 max-w-sm">
                        Browser camera access not available. Switch to <strong>Direct USB WebCam</strong> below.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraMode('hardware');
                          setCameraError(null);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md"
                      >
                        <Cpu className="w-3.5 h-3.5" /> Switch to Direct USB WebCam
                      </button>
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
                      ? '✓ Face Photo Confirmed. Fill employee details below.' 
                      : isScanningActive 
                      ? 'Follow the on-screen head turn instructions.' 
                      : faceDetected 
                      ? 'Face detected! Click "Capture Face" to lock photo.' 
                      : 'Center face in camera view.'}
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
                      onClick={() => {
                        setCapturedImage(null);
                        setScanProgress(0);
                        setScanStage('front_1');
                        scanStageRef.current = 'front_1';
                      }}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs bg-surface hover:bg-surface-hover text-text px-3 py-1.5 rounded-lg border border-border transition-colors font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake Photo
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs bg-surface hover:bg-surface-hover text-text px-3 py-1.5 rounded-lg border border-border transition-colors font-medium cursor-pointer"
                        title="Upload a clear portrait photo"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Upload Photo</span>
                      </button>

                      {cameraMode === 'hardware' ? (
                        <button 
                          type="button"
                          onClick={handleCaptureInstantHardware}
                          disabled={!hardwareFrame}
                          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Capture Face</span>
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={handleStartGuidedScan}
                          disabled={!modelsLoaded || isScanningActive || !faceDetected}
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isScanningActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          {isScanningActive ? 'Scanning Angles...' : 'Start Guided Scan'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Manual Employee Registration Form (Step A4) */}
              <div className="space-y-3.5 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Manual Employee Information Form
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
                      placeholder="e.g. Operations / IT"
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
                      placeholder="e.g. Security Supervisor"
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
                      placeholder="e.g. Main Gate / HQ"
                      className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                    />
                  </div>

                  {/* Mobile Phone */}
                  <div className="space-y-1">
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

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. employee@company.com"
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndRegister}
                  disabled={loading || !capturedImage || !name.trim() || !employeeId.trim() || idCheckStatus === 'taken'}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{loading ? 'Encrypting & Saving...' : 'Save & Register Employee'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
