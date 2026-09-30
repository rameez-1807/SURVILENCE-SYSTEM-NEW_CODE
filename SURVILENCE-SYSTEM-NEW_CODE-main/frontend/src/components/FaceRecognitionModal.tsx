import { useState, useRef, useEffect, useCallback } from 'react';
import { X, UserCheck, Loader2, AlertTriangle, RefreshCw, ShieldCheck, CameraOff, Check } from 'lucide-react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';

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

interface RecognitionHistoryItem {
  timestamp: number;
  matchFound: boolean;
  employee?: RecognizedEmployee;
  confidence?: number;
}

type IdentityState =
  | { type: 'idle' }
  | { type: 'unknown'; timestamp: number; box: faceapi.Box }
  | {
      type: 'matched';
      employee: RecognizedEmployee;
      confidence: number;
      timestamp: number;
      box: faceapi.Box;
      checkInTime?: string;
    };

export function FaceRecognitionModal({ isOpen, onClose }: FaceRecognitionModalProps) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
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

  const isRecognizingRef = useRef(false);
  const isMarkingAttendanceRef = useRef(false);
  const lastApiCallTimeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Laser scan line position states
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);

  // Smooth bounding box interpolation references
  const targetBoxRef = useRef<faceapi.Box | null>(null);
  const renderedBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Sliding window history for consensus-based identity anti-flicker
  const recognitionHistoryRef = useRef<RecognitionHistoryItem[]>([]);
  const currentIdentityRef = useRef<IdentityState>({ type: 'idle' });

  // Cooldown dictionary per employee_id to prevent duplicate attendance calls
  const attendanceCooldownRef = useRef<Record<string, { check_in: string; timestamp: number }>>({});

  // Configuration Constants
  const RECOGNITION_THROTTLE_MS = 450; // API throttle interval
  const IDENTITY_HOLD_MS = 1400; // Hold last stable identity during single frame drops
  const ATTENDANCE_COOLDOWN_MS = 60000; // 1 minute cooldown per employee for attendance API

  // 1. Load face-api neural network models
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
        console.error('Error loading face-api models:', e);
        if (isMounted) {
          setCameraError('Failed to load AI face recognition models from /models.');
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

  // 2. Stop camera stream & cancel animation loops
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isRecognizingRef.current = false;
    isMarkingAttendanceRef.current = false;
    currentIdentityRef.current = { type: 'idle' };
    recognitionHistoryRef.current = [];
    targetBoxRef.current = null;
    renderedBoxRef.current = null;
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;

      setStatusMessage('Scanning for faces...');
      setStatusLabel('Scanning...');
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
    if (isOpen && modelsLoaded) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setApiError(null);
      setLastAttendanceNotice(null);
    }
    return stopCamera;
  }, [isOpen, modelsLoaded, startCamera, stopCamera]);

  // Helper to mark attendance for a recognized employee
  const markAttendanceForEmployee = useCallback(async (emp: RecognizedEmployee, confidence: number) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const formattedCheckIn = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const existingCooldown = attendanceCooldownRef.current[emp.employee_id];
    if (existingCooldown && Date.now() - existingCooldown.timestamp < ATTENDANCE_COOLDOWN_MS) {
      setLastAttendanceNotice({
        name: emp.name,
        employee_id: emp.employee_id,
        check_in: existingCooldown.check_in,
      });
      return existingCooldown.check_in;
    }

    try {
      isMarkingAttendanceRef.current = true;
      const res = await api.post('/attendance', {
        employee_id: emp.employee_id,
        attendance_date: todayStr,
        first_seen: timeStr,
        last_seen: timeStr,
        camera_name: 'Live Camera',
        confidence: Math.round((confidence || 0.95) * 100),
      });

      const checkInDisplay = res.data.first_seen
        ? res.data.first_seen.substring(0, 5)
        : formattedCheckIn;

      attendanceCooldownRef.current[emp.employee_id] = {
        check_in: checkInDisplay,
        timestamp: Date.now(),
      };

      setLastAttendanceNotice({
        name: emp.name,
        employee_id: emp.employee_id,
        check_in: checkInDisplay,
      });

      return checkInDisplay;
    } catch (err: any) {
      console.error('Attendance API error:', err);
    } finally {
      isMarkingAttendanceRef.current = false;
    }
  }, []);

  // Compute Consensus Identity from Sliding History Buffer (Anti-Flicker)
  const processConsensusIdentity = useCallback(
    async (history: RecognitionHistoryItem[], currentBox: faceapi.Box) => {
      if (history.length === 0) return;

      // Tally employee match counts
      const counts: Record<string, { count: number; employee: RecognizedEmployee; totalConf: number }> = {};
      let unknownCount = 0;

      history.forEach((item) => {
        if (item.matchFound && item.employee) {
          const key = item.employee.employee_id;
          if (!counts[key]) {
            counts[key] = { count: 0, employee: item.employee, totalConf: 0 };
          }
          counts[key].count += 1;
          counts[key].totalConf += item.confidence ?? 0.95;
        } else {
          unknownCount += 1;
        }
      });

      // Find top matched employee
      let topMatchKey: string | null = null;
      let topMatchCount = 0;

      Object.keys(counts).forEach((key) => {
        if (counts[key].count > topMatchCount) {
          topMatchCount = counts[key].count;
          topMatchKey = key;
        }
      });

      // Consensus rules (requires at least 2 consistent matches out of last 5 frames)
      if (topMatchKey && topMatchCount >= 2) {
        const top = counts[topMatchKey];
        const avgConf = top.totalConf / top.count;

        const checkInTime = await markAttendanceForEmployee(top.employee, avgConf);

        currentIdentityRef.current = {
          type: 'matched',
          employee: top.employee,
          confidence: avgConf,
          timestamp: Date.now(),
          box: currentBox,
          checkInTime,
        };

        setStatusMessage(`Match Found: ${top.employee.name} (${top.employee.employee_id})`);
        setStatusLabel('Match Found');
        setStatusType('success');
      } else if (unknownCount >= 3) {
        currentIdentityRef.current = {
          type: 'unknown',
          timestamp: Date.now(),
          box: currentBox,
        };

        setStatusMessage('Unknown Face - No match in database');
        setStatusLabel('Unknown Face');
        setStatusType('error');
      }
    },
    [markAttendanceForEmployee]
  );

  // 4. Main Continuous Detection & Animation Loop
  useEffect(() => {
    if (!isOpen || !modelsLoaded || cameraError) return;

    const detectAndRecognize = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.paused || video.ended || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detectAndRecognize);
        return;
      }

      // Match canvas dimensions to video
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(detectAndRecognize);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        // Detect all faces in current frame
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        if (resizedDetections.length === 0) {
          // --- NO FACE DETECTED ---
          setStatusMessage('No face detected in camera view');
          setStatusLabel('Scanning...');
          setStatusType('warning');
          targetBoxRef.current = null;

          // Identity Hysteresis Hold: Hold last stable box briefly to avoid flickering on single dropped frame
          const currentIdent = currentIdentityRef.current;
          if (currentIdent.type !== 'idle' && renderedBoxRef.current) {
            if (Date.now() - currentIdent.timestamp < IDENTITY_HOLD_MS) {
              drawRecognitionOverlay(ctx, renderedBoxRef.current, currentIdent);
            } else {
              currentIdentityRef.current = { type: 'idle' };
              renderedBoxRef.current = null;
            }
          }
        } else if (resizedDetections.length > 1) {
          // --- MULTIPLE FACES DETECTED ---
          setStatusMessage('Multiple faces detected - Please show one face at a time');
          setStatusLabel('Multiple Faces');
          setStatusType('warning');
          targetBoxRef.current = null;
          renderedBoxRef.current = null;
          currentIdentityRef.current = { type: 'idle' };

          // Draw warning box on each detected face
          resizedDetections.forEach((det, idx) => {
            const { x, y, width, height } = det.detection.box;
            drawWarningBox(ctx, x, y, width, height, `Face ${idx + 1}`);
          });
        } else {
          // --- SINGLE FACE DETECTED ---
          const singleFace = resizedDetections[0];
          targetBoxRef.current = singleFace.detection.box;

          // Smooth coordinate interpolation (gliding box effect)
          if (!renderedBoxRef.current) {
            renderedBoxRef.current = {
              x: targetBoxRef.current.x,
              y: targetBoxRef.current.y,
              width: targetBoxRef.current.width,
              height: targetBoxRef.current.height,
            };
          } else {
            const lerpSpeed = 0.4;
            renderedBoxRef.current.x += (targetBoxRef.current.x - renderedBoxRef.current.x) * lerpSpeed;
            renderedBoxRef.current.y += (targetBoxRef.current.y - renderedBoxRef.current.y) * lerpSpeed;
            renderedBoxRef.current.width += (targetBoxRef.current.width - renderedBoxRef.current.width) * lerpSpeed;
            renderedBoxRef.current.height += (targetBoxRef.current.height - renderedBoxRef.current.height) * lerpSpeed;
          }

          const descriptorArray = Array.from(singleFace.descriptor);
          const now = Date.now();

          // Check if we should fire throttled recognition API call
          if (!isRecognizingRef.current && now - lastApiCallTimeRef.current >= RECOGNITION_THROTTLE_MS) {
            isRecognizingRef.current = true;
            lastApiCallTimeRef.current = now;
            setStatusLabel('Recognizing...');

            api.post('/employees/recognize', { face_encoding: descriptorArray })
              .then(async (res) => {
                setApiError(null);
                const history = recognitionHistoryRef.current;

                if (res.data.match_found && res.data.employee) {
                  history.push({
                    timestamp: Date.now(),
                    matchFound: true,
                    employee: res.data.employee,
                    confidence: res.data.confidence,
                  });
                } else {
                  history.push({
                    timestamp: Date.now(),
                    matchFound: false,
                  });
                }

                // Keep only last 5 recognition results in history
                if (history.length > 5) {
                  history.shift();
                }

                // Process consensus to update stable identity
                await processConsensusIdentity(history, singleFace.detection.box);
              })
              .catch((err) => {
                console.error('Recognition API error:', err);
                setApiError('Backend recognition API error / server unavailable');
              })
              .finally(() => {
                isRecognizingRef.current = false;
              });
          }

          // Draw active overlay with smooth rendered box
          const activeBox = renderedBoxRef.current;
          const currentIdent = currentIdentityRef.current;

          if (currentIdent.type !== 'idle' && activeBox) {
            drawRecognitionOverlay(ctx, activeBox, currentIdent);
          } else if (activeBox) {
            // Draw initial analyzing guide box with laser beam while building consensus
            drawGuideBox(
              ctx,
              activeBox.x,
              activeBox.y,
              activeBox.width,
              activeBox.height,
              '#3B82F6',
              'Analyzing Face...'
            );
            drawLaserBeam(ctx, activeBox.x, activeBox.y, activeBox.width, activeBox.height);
          }
        }
      } catch (err) {
        console.error('Detection loop error:', err);
      }

      animFrameRef.current = requestAnimationFrame(detectAndRecognize);
    };

    animFrameRef.current = requestAnimationFrame(detectAndRecognize);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, modelsLoaded, cameraError, processConsensusIdentity]);

  // Draw animated laser scan beam inside face box
  const drawLaserBeam = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
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
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
    gradient.addColorStop(0.5, 'rgba(96, 165, 250, 1)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#3B82F6';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(x, currentY);
    ctx.lineTo(x + w, currentY);
    ctx.stroke();

    ctx.restore();
  };

  // Helper for drawing rounded rectangles on Canvas across all browser versions
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  };

  // Canvas drawing helper for recognition card overlays
  const drawRecognitionOverlay = (
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; width: number; height: number },
    identity: IdentityState
  ) => {
    if (identity.type === 'idle') return;

    const { x, y, width, height } = box;
    const isMatch = identity.type === 'matched' && identity.employee;
    const strokeColor = isMatch ? '#10B981' : '#EF4444'; // Green for match, Red for unknown

    ctx.save();

    // 1. Glowing corner bounding box
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 10;

    const cornerLength = Math.min(width, height) * 0.25;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLength, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerLength);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + width, y + height - cornerLength);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width - cornerLength, y + height);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x + cornerLength, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + height - cornerLength);
    ctx.stroke();

    // Translucent face box fill
    ctx.fillStyle = isMatch ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(x, y, width, height);

    // Laser scan animation inside box
    drawLaserBeam(ctx, x, y, width, height);

    ctx.shadowBlur = 0; // Clear blur for text rendering

    // 2. Info Card Overlay Rendering
    if (isMatch && identity.employee) {
      const nameText = `✓ ${identity.employee.name}`;
      const idText = `${identity.employee.employee_id}`;
      const confPercent = Math.round((identity.confidence || 0.95) * 100);
      const confText = `${confPercent}% Match`;

      ctx.font = 'bold 15px Inter, sans-serif';
      const nameWidth = ctx.measureText(nameText).width;
      ctx.font = '600 12px Inter, sans-serif';
      const idWidth = ctx.measureText(idText).width;
      const confWidth = ctx.measureText(confText).width;

      const cardWidth = Math.max(nameWidth, idWidth, confWidth) + 28;
      const cardHeight = 68;

      let cardX = x + (width - cardWidth) / 2;
      cardX = Math.max(10, Math.min(cardX, ctx.canvas.width - cardWidth - 10));

      let cardY = y + height + 12;
      if (cardY + cardHeight > ctx.canvas.height - 10) {
        cardY = Math.max(10, y - cardHeight - 12);
      }

      // Card Dark Glass Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 10);
      ctx.fill();
      ctx.stroke();

      // Line 1: ✓ Name
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText(nameText, cardX + 14, cardY + 22);

      // Line 2: Employee ID
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(idText, cardX + 14, cardY + 41);

      // Line 3: Confidence Match
      ctx.fillStyle = '#34D399';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText(confText, cardX + 14, cardY + 58);

    } else {
      // Unknown Person Card
      const unknownText = '⚠ Unknown Person';
      ctx.font = 'bold 14px Inter, sans-serif';
      const textWidth = ctx.measureText(unknownText).width;

      const cardWidth = textWidth + 28;
      const cardHeight = 36;

      let cardX = x + (width - cardWidth) / 2;
      cardX = Math.max(10, Math.min(cardX, ctx.canvas.width - cardWidth - 10));

      let cardY = y + height + 12;
      if (cardY + cardHeight > ctx.canvas.height - 10) {
        cardY = Math.max(10, y - cardHeight - 12);
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(unknownText, cardX + 14, cardY + 23);
    }

    ctx.restore();
  };

  // Helper box for warnings or analyzing state
  const drawWarningBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string
  ) => {
    drawGuideBox(ctx, x, y, w, h, '#EF4444', label);
  };

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
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = '600 12px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(x, Math.max(0, y - 24), textWidth + 16, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, x + 8, Math.max(15, y - 9));
    ctx.restore();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Live Biometric Face Recognition</h2>
              <p className="text-xs text-text-muted">Real-time matching & auto attendance marking</p>
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
          ) : !modelsLoaded ? (
            <div className="flex flex-col items-center gap-3 text-white z-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-text-muted">Loading AI face recognition models...</p>
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
          {modelsLoaded && !cameraError && (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-white shadow-lg">
                <span className={`w-2 h-2 rounded-full ${statusType === 'success' ? 'bg-emerald-400 animate-pulse' : statusType === 'error' ? 'bg-rose-500' : statusType === 'warning' ? 'bg-amber-400 animate-pulse' : 'bg-primary animate-ping'}`} />
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
            <div className="absolute bottom-4 left-4 right-4 bg-emerald-950/90 border border-emerald-500/40 backdrop-blur-md text-white p-3.5 rounded-xl flex items-center justify-between z-30 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 uppercase tracking-wider">
                    ✓ Attendance Marked
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {lastAttendanceNotice.name} <span className="font-mono text-emerald-300 font-normal">({lastAttendanceNotice.employee_id})</span>
                  </div>
                </div>
              </div>
              <div className="text-right border-l border-white/10 pl-4">
                <div className="text-[10px] text-emerald-200/70 uppercase font-medium">Check-in Time</div>
                <div className="text-xs font-mono font-bold text-emerald-300">{lastAttendanceNotice.check_in}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3.5 bg-surface-hover/30 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>AI Surveillance System &bull; Live Attendance Sync Active</span>
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
