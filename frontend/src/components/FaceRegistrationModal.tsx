import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FaceRegistrationModal({ isOpen, onClose, onSuccess }: FaceRegistrationModalProps) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [embedding, setEmbedding] = useState<number[] | null>(null);

  // 360 Scan States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (e) {
        console.error("Error loading face-api models", e);
        setError("Failed to load AI models.");
      }
    };
    if (isOpen && !modelsLoaded) {
      loadModels();
    }
  }, [isOpen, modelsLoaded]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      
      // Reset states
      setCapturedImage(null);
      setEmbedding(null);
      setError(null);
      setIsScanning(false);
      setScanProgress(0);
      setScanComplete(false);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen && modelsLoaded) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setName('');
      setEmployeeId('');
      setCapturedImage(null);
      setEmbedding(null);
      setError(null);
      setIsScanning(false);
      setScanProgress(0);
      setScanComplete(false);
    }
    return stopCamera;
  }, [isOpen, modelsLoaded, startCamera, stopCamera]);

  const start360Scan = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    setError(null);
    setEmbedding(null);
    setCapturedImage(null);

    const descriptors: Float32Array[] = [];
    let progress = 0;
    
    // Sample a face embedding every 300ms
    const scanInterval = window.setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
        if (detection) {
          descriptors.push(detection.descriptor);
        }
      } catch (e) {
        // ignore errors during scan
      }
    }, 300);

    // Update progress bar every 100ms (Total scan time = 4 seconds)
    const progressInterval = window.setInterval(() => {
      progress += 2.5; 
      setScanProgress(progress);
      
      if (progress >= 100) {
        window.clearInterval(scanInterval);
        window.clearInterval(progressInterval);
        setIsScanning(false);
        setScanComplete(true);
        
        if (descriptors.length > 0) {
          // Average the descriptors for a robust 360 representation
          const avg = new Array(128).fill(0);
          descriptors.forEach(d => {
              for(let i=0; i<128; i++) avg[i] += d[i];
          });
          for(let i=0; i<128; i++) avg[i] /= descriptors.length;
          setEmbedding(avg);
          
          // Capture a final thumbnail
          if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
          }
          stopCamera();
        } else {
          setError("No face detected during scan. Please stay in frame and try again.");
          setScanProgress(0);
          setScanComplete(false);
        }
      }
    }, 100);
  };

  const retakePhoto = () => {
    startCamera();
  };

  const handleRegister = async () => {
    if (!name || !employeeId || !embedding) {
      setError('Please fill all fields and complete the 360 face scan.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await api.post('/employees/register', {
        name,
        employee_id: employeeId,
        face_encoding: embedding
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register employee face.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/30">
          <h2 className="text-lg font-semibold text-text">Register Employee Face</h2>
          <button 
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!modelsLoaded && !error && (
            <div className="flex items-center gap-2 text-text-muted bg-surface border border-border p-3 rounded-md text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading AI Models...
            </div>
          )}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium text-text-muted">360 Face Scan</label>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border">
              {capturedImage ? (
                <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover opacity-80" />
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
              )}

              {/* Scanning Overlay */}
              {isScanning && (
                <div className="absolute inset-0 bg-primary/10 flex flex-col items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-dashed border-primary/50 rounded-full animate-[spin_4s_linear_infinite] absolute" />
                  <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white font-medium text-sm z-10 animate-pulse">
                    Please look slightly left, right, up, and down...
                  </div>
                  <div className="absolute bottom-6 w-3/4 max-w-xs bg-surface-hover rounded-full h-3 overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-primary transition-all duration-100 ease-linear"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Overlay */}
              {scanComplete && capturedImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-success/20 backdrop-blur-md border border-success text-success px-6 py-3 rounded-full flex items-center gap-2 animate-in zoom-in-90 duration-300 shadow-xl">
                    <Check className="w-5 h-5" />
                    <span className="font-bold">Scan Complete</span>
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                {scanComplete ? (
                  <button 
                    onClick={retakePhoto}
                    className="flex items-center gap-2 bg-surface hover:bg-surface-hover text-text px-4 py-2 rounded-full shadow-lg transition-colors text-sm font-medium"
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rescan Face
                  </button>
                ) : (
                  <button 
                    onClick={start360Scan}
                    disabled={!modelsLoaded || isScanning}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full shadow-lg transition-colors font-medium disabled:opacity-50"
                  >
                    {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    {isScanning ? 'Scanning...' : 'Start 360 Scan'}
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-text-muted text-center pt-1">
              Position your face in the center, click Start, and slowly move your head.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted disabled:opacity-50"
                disabled={!scanComplete || loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted">Employee ID</label>
              <input 
                type="text" 
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="EMP-123"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted disabled:opacity-50"
                disabled={!scanComplete || loading}
              />
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-hover/30 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-text hover:bg-surface border border-transparent rounded-md transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleRegister}
            disabled={loading || !embedding || !name || !employeeId}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-md transition-colors text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Register
          </button>
        </div>
        
      </div>
    </div>
  );
}
