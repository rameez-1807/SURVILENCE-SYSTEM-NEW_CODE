import { useState, useRef, useEffect, useCallback } from 'react';
import { X, UserCheck, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import * as faceapi from 'face-api.js';

interface FaceRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FaceRecognitionModal({ isOpen, onClose }: FaceRecognitionModalProps) {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

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
      startRecognitionLoop();
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const recognizeFace = async () => {
    if (!videoRef.current || isRecognizing || !modelsLoaded || !canvasRef.current) return;

    try {
      setIsRecognizing(true);
      
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      
      if (detection && videoRef.current && canvasRef.current) {
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        
        const res = await api.post('/employees/recognize', {
          face_encoding: Array.from(detection.descriptor)
        });
        
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (res.data.match_found) {
          const drawBox = new faceapi.draw.DrawBox(resizedDetections.detection.box, { 
            label: `${res.data.employee.name} (${res.data.employee.employee_id})`,
            boxColor: '#10b981', // Tailwind success
            drawLabelOptions: {
              fontSize: 24,
              fontColor: '#ffffff',
              padding: 10
            }
          });
          drawBox.draw(canvasRef.current);
        } else {
          const drawBox = new faceapi.draw.DrawBox(resizedDetections.detection.box, { 
            label: 'Unknown Person',
            boxColor: '#ef4444', // Tailwind danger
            drawLabelOptions: {
              fontSize: 24,
              fontColor: '#ffffff',
              padding: 10
            }
          });
          drawBox.draw(canvasRef.current);
        }
        
        // Clear the canvas after 1.8 seconds (just before next scan)
        setTimeout(() => {
          const context = canvasRef.current?.getContext('2d');
          context?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
        }, 1800);
      } else {
        // No face detected, clear canvas
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
      }
    } catch (err) {
      // ignore
    } finally {
      setIsRecognizing(false);
    }
  };

  const startRecognitionLoop = useCallback(() => {
    intervalRef.current = window.setInterval(recognizeFace, 2000);
  }, [modelsLoaded, isRecognizing]);

  useEffect(() => {
    if (isOpen && modelsLoaded) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
      setError(null);
    }
    return stopCamera;
  }, [isOpen, modelsLoaded, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-border w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/30">
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Live Face Recognition
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-danger font-medium bg-danger/10 px-4 py-2 rounded-md z-10">
              {error}
            </div>
          ) : !modelsLoaded ? (
            <div className="flex items-center gap-2 text-white z-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Loading AI Models...
            </div>
          ) : null}

          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover z-10"
          />

          {/* Status Indicator */}
          {modelsLoaded && !error && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 z-20">
              {isRecognizing ? (
                <>
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  <span className="text-xs text-white font-medium">Scanning...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-xs text-white font-medium">Active</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
