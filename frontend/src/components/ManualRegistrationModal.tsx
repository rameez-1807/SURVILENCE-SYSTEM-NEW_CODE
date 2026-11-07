import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Camera, UserCheck, ShieldCheck, UserPlus, CalendarClock, AlertTriangle, Upload } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { api } from '../lib/api';

interface ManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'employees' | 'records';
}

export function ManualRegistrationModal({ isOpen, onClose, onSuccess, type: initialType }: ManualRegistrationModalProps) {
  const isSecure = typeof window !== 'undefined' && 
    (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const [modalMode, setModalMode] = useState<'employees' | 'records'>(initialType || 'records');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form states
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  
  // Specific to records
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkIn, setCheckIn] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [checkOut, setCheckOut] = useState('');

  // Specific to employees
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  // Face Recognition & Camera States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedFaceImage, setCapturedFaceImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ match_found: boolean; employee?: any } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync mode with prop when opened
  useEffect(() => {
    if (isOpen) {
      setModalMode(initialType || 'records');
      setDate(new Date().toISOString().split('T')[0]);
      const d = new Date();
      setCheckIn(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
  }, [isOpen, initialType]);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        }
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
          await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        }
        if (!faceapi.nets.faceRecognitionNet.isLoaded) {
          await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        }
        setModelsLoaded(true);
      } catch (e) {
        console.warn('Face models load notice:', e);
      }
    };
    if (isOpen && !modelsLoaded) {
      loadModels();
    }
  }, [isOpen, modelsLoaded]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setEmpId('');
      setName('');
      setCheckOut('');
      setDepartment('');
      setDesignation('');
      setError(null);
      setSuccessNotice(null);
      setScanResult(null);
      setCapturedFaceImage(null);
      setFaceDetected(false);
    }
    return stopCamera;
  }, [isOpen, stopCamera]);

  // Grab JPEG frame from live video element
  const captureFrameFromVideo = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  }, []);

  // Photo Upload Handler for enrollment / attendance
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setCapturedFaceImage(b64);
      setFaceDetected(true);
      setError(null);
      stopCamera();

      // Attempt client-side faceapi detection if models loaded
      if (modelsLoaded) {
        try {
          const img = new Image();
          img.src = b64;
          img.onload = async () => {
            try {
              const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
              if (detection) {
                const descriptorArray = Array.from(detection.descriptor);
                const res = await api.post('/employees/recognize', {
                  face_encoding: descriptorArray
                });
                if (res.data.match_found && res.data.employee) {
                  setScanResult(res.data);
                  setEmpId(prev => prev || res.data.employee.employee_id);
                  setName(prev => prev || res.data.employee.name);
                  if (res.data.employee.department) {
                    setDepartment(prev => prev || res.data.employee.department);
                  }
                }
              }
            } catch {
              // Ignore
            }
          };
        } catch {
          // Ignore
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Start webcam and face detection
  const startCameraAndScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
    setFaceDetected(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isSecure) {
          setError('Camera blocked by browser: Public HTTP IP requires HTTPS or Chrome Insecure Origin Flag. Click "Upload Photo" below to continue.');
        } else {
          setError('Camera MediaDevices API not supported by browser. Click "Upload Photo" below.');
        }
        setIsScanning(false);
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      streamRef.current = stream;
      
      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        try {
          const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
          if (detection) {
            setFaceDetected(true);
            const frameB64 = captureFrameFromVideo();
            if (frameB64) {
              setCapturedFaceImage(frameB64);
            }

            // Check if already registered in system
            const descriptorArray = Array.from(detection.descriptor);
            try {
              const res = await api.post('/employees/recognize', {
                face_encoding: descriptorArray
              });
              if (res.data.match_found && res.data.employee) {
                setScanResult(res.data);
                // Pre-fill fields if empty
                setEmpId(prev => prev || res.data.employee.employee_id);
                setName(prev => prev || res.data.employee.name);
                if (res.data.employee.department) {
                  setDepartment(prev => prev || res.data.employee.department);
                }
              }
            } catch {
              // Ignore recognition lookup error
            }
          } else {
            setFaceDetected(false);
          }
        } catch (e) {
          console.warn('Frame detection notice:', e);
        }
      }, 700);

    } catch (err: any) {
      if (!isSecure) {
        setError('Camera blocked on HTTP IP. Use HTTPS (https://), or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure, or click "Upload Photo".');
      } else {
        setError('Could not access camera device. Check webcam permissions.');
      }
      setIsScanning(false);
    }
  };

  // Auto-start camera when modal opens
  useEffect(() => {
    if (isOpen && modelsLoaded && !isScanning && !capturedFaceImage) {
      void startCameraAndScan();
    }
  }, [isOpen, modelsLoaded]);

  const handleManualCapture = () => {
    const frame = captureFrameFromVideo();
    if (frame) {
      setCapturedFaceImage(frame);
      setFaceDetected(true);
    }
  };

  // Submit Handler
  const handleRegister = async () => {
    if (!empId.trim() || !name.trim()) {
      setError('Employee ID and Full Name are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessNotice(null);

      // If user hasn't frozen snapshot yet, take from live video
      let finalFaceImage = capturedFaceImage;
      if (!finalFaceImage && isScanning) {
        finalFaceImage = captureFrameFromVideo();
      }

      if (modalMode === 'employees') {
        // Mode 1: Register Employee with Facenox 512-d Biometrics
        if (finalFaceImage) {
          await api.post('/employees/register-facenox', {
            name: name.trim(),
            employee_id: empId.trim(),
            department: department.trim() || undefined,
            designation: designation.trim() || undefined,
            image: finalFaceImage,
          });
        } else {
          // Register without face photo if camera not active
          await api.post('/employees/register', {
            name: name.trim(),
            employee_id: empId.trim(),
            department: department.trim() || undefined,
            designation: designation.trim() || undefined,
          });
        }

        setSuccessNotice(`Employee ${name.trim()} (${empId.trim()}) registered successfully with face biometrics!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);

      } else {
        // Mode 2: Save Attendance Record (Auto-registers employee if not existing)
        await api.post('/attendance', {
          employee_id: empId.trim(),
          employee_name: name.trim(),
          face_image: finalFaceImage || undefined,
          attendance_date: date || new Date().toISOString().split('T')[0],
          first_seen: checkIn || '09:00',
          last_seen: checkOut || checkIn || '09:00',
          camera_name: 'Manual Face Entry',
          confidence: 100.0,
        });

        setSuccessNotice(`Attendance recorded successfully for ${name.trim()} (${empId.trim()})!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to save record.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header with Mode Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">
                {modalMode === 'employees' ? 'Manual Employee Registration' : 'Manual Attendance Entry'}
              </h2>
              <p className="text-[11px] text-text-muted">Face Detection &bull; Biometric Enrollment &bull; Auto Check-in</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Toggle */}
            <div className="flex items-center bg-[#0a0f1d] p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => {
                  setModalMode('employees');
                  setError(null);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  modalMode === 'employees'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span>Register Employee</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('records');
                  setError(null);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  modalMode === 'records'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <CalendarClock className="w-3 h-3" />
                <span>Attendance Entry</span>
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* AI Face Detection Section */}
          <div className="bg-surface-hover/50 border border-border rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  Live Face Camera
                </span>
                <span className="text-[11px] text-text-muted">
                  {faceDetected ? '✓ Face detected! Frame ready for enrollment' : 'Looking for face in camera...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] bg-surface hover:bg-surface-hover border border-border text-text px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer"
                  title="Upload portrait photo directly"
                >
                  <Upload className="w-3 h-3 text-cyan-400" /> Upload Photo
                </button>
                {!isScanning ? (
                  <button 
                    type="button"
                    onClick={startCameraAndScan} 
                    className="flex items-center gap-1 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer"
                  >
                    <Camera className="w-3 h-3" /> Start Cam
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleManualCapture}
                    className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md transition-all font-semibold shadow-sm cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Capture Face
                  </button>
                )}
              </div>
            </div>

            {/* Camera Preview */}
            {isScanning && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2.5 left-0 right-0 flex justify-center">
                  <div className={`text-[11px] backdrop-blur px-3 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-md ${
                    faceDetected 
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-black/70 text-text-muted border border-white/10'
                  }`}>
                    {faceDetected ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Face Detected &bull; Ready</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                        <span>Scanning for face...</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Match Result Success */}
            {scanResult && scanResult.match_found && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg flex items-center gap-2 font-medium">
                <UserCheck className="w-4 h-4 shrink-0" /> 
                <span>Recognized {scanResult.employee?.name} ({scanResult.employee?.employee_id})!</span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Employee ID *</label>
                <input 
                  type="text" 
                  value={empId}
                  onChange={e => setEmpId(e.target.value)}
                  placeholder="e.g. EMP-103"
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Full Name *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. RAMEEZ"
                  className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                />
              </div>
            </div>
            
            {modalMode === 'records' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">Date *</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">Check-In Time *</label>
                  <input 
                    type="time" 
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-text-muted">Check-Out Time (Optional)</label>
                  <input 
                    type="time" 
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {modalMode === 'employees' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">Department</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. Operations / IT"
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">Designation</label>
                  <input 
                    type="text" 
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder="e.g. Security Supervisor"
                    className="w-full bg-[#0a0f1d] border border-border/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white placeholder-text-muted"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-hover/30 flex justify-end gap-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-text hover:bg-surface border border-border rounded-lg transition-colors text-xs font-semibold"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleRegister}
            disabled={loading || !empId.trim() || !name.trim()}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-lg transition-all text-xs font-semibold shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>
              {modalMode === 'employees' 
                ? (loading ? 'Registering...' : 'Register Employee & Face') 
                : (loading ? 'Saving...' : 'Save Attendance')}
            </span>
          </button>
        </div>
        
      </div>
    </div>
  );
}
