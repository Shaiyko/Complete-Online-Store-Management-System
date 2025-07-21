import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Flashlight, FlashlightOff, RotateCcw, Scan } from 'lucide-react';

interface BarcodeQRScannerProps {
  onScan: (data: string, type: 'barcode' | 'qr') => void;
  onClose: () => void;
  isOpen: boolean;
  title?: string;
}

const BarcodeQRScanner: React.FC<BarcodeQRScannerProps> = ({ 
  onScan, 
  onClose, 
  isOpen, 
  title = "Scan Barcode or QR Code" 
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [scanMode, setScanMode] = useState<'auto' | 'barcode' | 'qr'>('auto');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrScannerRef = useRef<any>(null);
  const barcodeScannerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      const cameraId = selectedCamera || backCamera?.deviceId || videoDevices[0]?.deviceId;
      
      if (cameraId) {
        setSelectedCamera(cameraId);
        await startCamera(cameraId);
      } else {
        setError('ไม่พบกล้อง');
      }
    } catch (err) {
      console.error('Camera initialization error:', err);
      setError('ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งาน');
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
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
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
      setError('ไม่สามารถเริ่มกล้องได้');
      setHasPermission(false);
    }
  };

  const startScanning = async () => {
    if (!videoRef.current || isScanning) return;

    try {
      setIsScanning(true);
      
      // Start QR Code scanning
      await startQRScanning();
      
      // Start Barcode scanning
      await startBarcodeScanning();
      
    } catch (err) {
      console.error('Scanner start error:', err);
      setError('ไม่สามารถเริ่มการสแกนได้');
      setIsScanning(false);
    }
  };

  const startQRScanning = async () => {
    try {
      const QrScanner = (await import('qr-scanner')).default;
      
      const scanner = new QrScanner(
        videoRef.current!,
        (result: any) => {
          const data = typeof result === 'string' ? result : result.data;
          if (data && (scanMode === 'auto' || scanMode === 'qr')) {
            onScan(data, 'qr');
            cleanup();
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
    } catch (err) {
      console.error('QR Scanner error:', err);
    }
  };

  const startBarcodeScanning = async () => {
    try {
      const Quagga = (await import('quagga')).default;
      
      if (!canvasRef.current || !videoRef.current) return;

      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: canvasRef.current,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader"
          ]
        },
        locate: true
      }, (err: any) => {
        if (err) {
          console.error('Barcode scanner init error:', err);
          return;
        }
        Quagga.start();
      });

      Quagga.onDetected((data: any) => {
        if (data.codeResult && (scanMode === 'auto' || scanMode === 'barcode')) {
          const barcode = data.codeResult.code;
          if (barcode) {
            onScan(barcode, 'barcode');
            cleanup();
          }
        }
      });

      barcodeScannerRef.current = Quagga;
    } catch (err) {
      console.error('Barcode scanner error:', err);
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
    if (qrScannerRef.current) {
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    
    if (barcodeScannerRef.current) {
      barcodeScannerRef.current.stop();
      barcodeScannerRef.current = null;
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

        {/* Scan Mode Selector */}
        <div className="absolute top-16 left-0 right-0 z-10 p-4">
          <div className="flex justify-center space-x-2">
            {[
              { value: 'auto', label: 'อัตโนมัติ' },
              { value: 'qr', label: 'QR Code' },
              { value: 'barcode', label: 'Barcode' }
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setScanMode(mode.value as any)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  scanMode === mode.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Camera View */}
        <div className="relative w-full h-full flex items-center justify-center">
          {hasPermission === null && (
            <div className="text-white text-center">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>กำลังขอสิทธิ์เข้าถึงกล้อง...</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="text-white text-center p-4">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">ไม่สามารถเข้าถึงกล้องได้</p>
              <p className="text-sm opacity-75">
                กรุณาอนุญาตการใช้งานกล้องและรีเฟรชหน้า
              </p>
            </div>
          )}

          {error && (
            <div className="text-white text-center p-4">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">เกิดข้อผิดพลาดกับกล้อง</p>
              <p className="text-sm opacity-75">{error}</p>
              <button
                onClick={initializeCamera}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                ลองใหม่
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
              
              {/* Canvas for barcode scanning */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full opacity-0"
              />
              
              {/* Scanning Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-64 h-64 border-2 border-white border-opacity-50 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                    
                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
                  </div>
                  <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white text-center">
                    <p className="text-sm">วางบาร์โค้ดหรือ QR Code ในกรอบ</p>
                    <p className="text-xs opacity-75 mt-1">
                      โหมด: {scanMode === 'auto' ? 'อัตโนมัติ' : scanMode === 'qr' ? 'QR Code' : 'Barcode'}
                    </p>
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

              {/* Manual Scan Button */}
              <button
                onClick={() => {
                  // Force a scan attempt
                  if (videoRef.current && canvasRef.current) {
                    const canvas = canvasRef.current;
                    const video = videoRef.current;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      ctx.drawImage(video, 0, 0);
                    }
                  }
                }}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <Scan className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeQRScanner;