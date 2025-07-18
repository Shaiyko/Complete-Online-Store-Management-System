import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Flashlight, FlashlightOff, RotateCcw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
  title?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isOpen, title = "Scan QR Code" }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      initializeCamera();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen, selectedCamera]);

  const initializeCamera = async () => {
    try {
      setError('');
      
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      
      // Select back camera by default on mobile
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      const cameraId = selectedCamera || backCamera?.deviceId || videoDevices[0]?.deviceId;
      
      if (cameraId) {
        setSelectedCamera(cameraId);
        await startCamera(cameraId);
      } else {
        setError('No cameras found');
      }
    } catch (err) {
      console.error('Camera initialization error:', err);
      setError('Failed to access camera. Please check permissions.');
      setHasPermission(false);
    }
  };

  const startCamera = async (deviceId: string) => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasPermission(true);
        startScanning();
      }
    } catch (err) {
      console.error('Camera start error:', err);
      setError('Failed to start camera');
      setHasPermission(false);
    }
  };

  const startScanning = async () => {
    if (!videoRef.current || isScanning) return;

    try {
      setIsScanning(true);
      
      // Dynamic import for QR Scanner
      const QrScanner = (await import('qr-scanner')).default;
      
      const scanner = new QrScanner(
        videoRef.current,
        (result: any) => {
          const data = typeof result === 'string' ? result : result.data;
          if (data) {
            onScan(data);
            cleanup();
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
    } catch (err) {
      console.error('Scanner start error:', err);
      setError('Failed to start QR scanner');
      setIsScanning(false);
    }
  };

  const toggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && 'torch' in track.getCapabilities()) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !flashEnabled } as any]
          });
          setFlashEnabled(!flashEnabled);
        } catch (err) {
          console.error('Flash toggle error:', err);
        }
      }
    }
  };

  const switchCamera = () => {
    const currentIndex = cameras.findIndex(camera => camera.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    if (nextCamera) {
      setSelectedCamera(nextCamera.deviceId);
    }
  };

  const cleanup = () => {
    if (scannerRef.current) {
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsScanning(false);
    setFlashEnabled(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative w-full h-full max-w-md max-h-screen bg-black">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 p-4">
          <div className="flex items-center justify-between text-white">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative w-full h-full flex items-center justify-center">
          {hasPermission === null && (
            <div className="text-white text-center">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Requesting camera permission...</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="text-white text-center p-4">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">Camera access denied</p>
              <p className="text-sm opacity-75">
                Please enable camera permissions and refresh the page
              </p>
            </div>
          )}

          {error && (
            <div className="text-white text-center p-4">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Camera Error</p>
              <p className="text-sm opacity-75">{error}</p>
              <button
                onClick={initializeCamera}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {hasPermission && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Scanning Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-64 h-64 border-2 border-white border-opacity-50 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white text-center">
                    <p className="text-sm">Position QR code within the frame</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        {hasPermission && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-50 p-4">
            <div className="flex items-center justify-center space-x-6">
              {/* Flash Toggle */}
              <button
                onClick={toggleFlash}
                className={`p-3 rounded-full transition-colors ${
                  flashEnabled 
                    ? 'bg-yellow-500 text-black' 
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                {flashEnabled ? (
                  <FlashlightOff className="h-6 w-6" />
                ) : (
                  <Flashlight className="h-6 w-6" />
                )}
              </button>

              {/* Camera Switch */}
              {cameras.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="p-3 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30 transition-colors"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;