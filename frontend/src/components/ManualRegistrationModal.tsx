import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Camera, UserCheck } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { api } from '../lib/api';

interface ManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'employees' | 'records';
}

export function ManualRegistrationModal({ isOpen, onClose, onSuccess, type }: ManualRegistrationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  
  // Specific to records
  const [date, setDate] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  // Specific to employees
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  // Face Recognition States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ match_found: boolean; employee?: any } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (e) {
        console.error(e);
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

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      // Reset form
      setEmpId('');
      setName('');
      setDate('');
      setCheckIn('');
      setCheckOut('');
      setDepartment('');
      setDesignation('');
      setError(null);
      setScanResult(null);
    }
    return stopCamera;
  }, [isOpen, stopCamera]);

  const [capturedFace, setCapturedFace] = useState<number[] | null>(null);

  const startCameraAndScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      
      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
          if (detection) {
            const descriptorArray = Array.from(detection.descriptor);
            setCapturedFace(descriptorArray);
            const res = await api.post('/employees/recognize', {
              face_encoding: descriptorArray
            });
            
            if (res.data.match_found) {
              setScanResult(res.data);
              
              // Auto-fill forms
              setEmpId(res.data.employee.employee_id);
              setName(res.data.employee.name);
              if (type === 'employees') {
                setDepartment(res.data.employee.department || '');
                setDesignation(res.data.employee.designation || '');
              }

              // Stop camera automatically after successful recognition
              setTimeout(() => stopCamera(), 1000);
            } else {
              // If face is scanned but not recognized, still keep it for registration
              setScanResult({ match_found: false });
              setTimeout(() => stopCamera(), 1000);
            }
          }
        } catch (e) {
          console.warn('Manual registration frame detection warning:', e);
        }
      }, 1000);

    } catch (err) {
      setError('Could not access camera.');
      setIsScanning(false);
    }
  };

  const handleRegister = async () => {
    if (!empId || !name) {
      setError('Please fill required fields.');
      return;
    }
    if (type === 'records' && (!date || !checkIn || !checkOut)) {
      setError('Please fill in Date, Check-In and Check-Out time.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (type === 'employees') {
        await api.post('/employees/register', {
          name,
          employee_id: empId,
          department,
          designation,
          face_encoding: capturedFace
        });
      } else {
        // Real API call to create attendance record
        await api.post('/attendance', {
          employee_id: empId,
          attendance_date: date,
          first_seen: checkIn,
          last_seen: checkOut,
          camera_name: 'Manual Entry',
          confidence: 100.0,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save record. Make sure the Employee ID is registered first.');
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
          <h2 className="text-lg font-semibold text-text">
            Manual Registration ({type === 'employees' ? 'Employee' : 'Attendance'})
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* AI Auto-fill Section */}
          <div className="bg-surface-hover/50 border border-border rounded-lg p-4 space-y-3">
             <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-text block">AI Face Auto-fill</span>
                  <span className="text-xs text-text-muted">Scan face to automatically fill employee details</span>
                </div>
                {!isScanning && !scanResult?.match_found && (
                   <button 
                     onClick={startCameraAndScan} 
                     disabled={!modelsLoaded}
                     className="flex items-center gap-2 text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-2 rounded-md transition-colors font-medium border border-primary/20 disabled:opacity-50"
                   >
                     {modelsLoaded ? <Camera className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                     {modelsLoaded ? 'Start Scanner' : 'Loading Models...'}
                   </button>
                )}
                {scanResult?.match_found && !isScanning && (
                  <button 
                    onClick={startCameraAndScan} 
                    className="flex items-center gap-2 text-xs bg-surface text-text-muted px-3 py-2 rounded-md transition-colors border border-border"
                  >
                    Rescan
                  </button>
                )}
             </div>

             {/* Camera Preview */}
             {isScanning && (
               <div className="relative aspect-video bg-black rounded-md overflow-hidden border border-border mt-2">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <div className="text-xs text-white bg-black/60 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" /> Scanning for face...
                    </div>
                  </div>
               </div>
             )}
             
             {/* Match Result Success */}
             {scanResult && scanResult.match_found && !isScanning && (
                <div className="text-sm text-success bg-success/10 border border-success/20 px-3 py-2 rounded-md flex items-center gap-2 mt-2 font-medium">
                   <UserCheck className="w-4 h-4" /> 
                   Recognized {scanResult.employee?.name} ({scanResult.employee?.employee_id})! Fields auto-filled.
                </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted">Employee ID *</label>
              <input 
                type="text" 
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                placeholder="EMP-123"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-muted">Full Name *</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted transition-colors"
              />
            </div>
            
            {type === 'records' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Date *</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Check-In Time *</label>
                  <input 
                    type="time" 
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-sm font-medium text-text-muted">Check-Out Time *</label>
                  <input 
                    type="time" 
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted"
                  />
                </div>
              </>
            )}

            {type === 'employees' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Department</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Engineering"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Designation</label>
                  <input 
                    type="text" 
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder="Developer"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder-text-muted transition-colors"
                  />
                </div>
              </>
            )}
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
            disabled={loading || !empId || !name}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-md transition-colors text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {type === 'employees' ? 'Register Employee' : 'Save Attendance'}
          </button>
        </div>
        
      </div>
    </div>
  );
}
