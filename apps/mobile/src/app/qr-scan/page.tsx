'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface CheckinResult {
  success: boolean;
  message: string;
  checkInTime?: string;
  isLate?: boolean;
  storeName?: string;
}

export default function QRScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }

    // Request camera permission and start stream
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStatus('scanning');
      }
    } catch (error) {
      console.error('Camera error:', error);
      setHasPermission(false);
      setErrorMessage('카메라 접근 권한이 필요합니다.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Simulate QR scan for demo purposes
  const handleScanDemo = async () => {
    if (status !== 'scanning') return;

    setStatus('processing');

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Demo result
    const demoResult: CheckinResult = {
      success: true,
      message: '출근이 완료되었습니다.',
      checkInTime: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isLate: false,
      storeName: '강남점',
    };

    setResult(demoResult);
    setStatus(demoResult.success ? 'success' : 'error');

    // Vibration feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(demoResult.success ? [100] : [100, 50, 100]);
    }

    // Auto redirect after success
    if (demoResult.success) {
      setTimeout(() => {
        router.push('/home');
      }, 2000);
    }
  };

  const renderContent = () => {
    if (hasPermission === false) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white text-center p-6">
          <Camera className="w-16 h-16 mb-4 text-white/50" />
          <h2 className="text-xl font-bold mb-2">카메라 권한 필요</h2>
          <p className="text-white/70 mb-6">{errorMessage}</p>
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-white text-primary font-semibold rounded-xl"
          >
            다시 시도
          </button>
        </div>
      );
    }

    if (status === 'processing') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <Loader2 className="w-16 h-16 text-white animate-spin mb-4" />
          <p className="text-white text-lg font-medium">출근 처리 중...</p>
        </div>
      );
    }

    if (status === 'success' && result) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-600 z-20 p-6">
          <CheckCircle className="w-20 h-20 text-white mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">출근 완료!</h2>
          <p className="text-white/90 text-center mb-4">{result.message}</p>
          <div className="bg-white/20 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{result.storeName}</p>
            <p className="text-3xl font-bold">{result.checkInTime}</p>
            {result.isLate && (
              <p className="text-yellow-300 text-sm mt-1">* 지각 처리되었습니다</p>
            )}
          </div>
        </div>
      );
    }

    if (status === 'error' && result) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600 z-20 p-6">
          <XCircle className="w-20 h-20 text-white mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">출근 실패</h2>
          <p className="text-white/90 text-center mb-6">{result.message}</p>
          <button
            onClick={() => {
              setStatus('scanning');
              setResult(null);
            }}
            className="px-6 py-3 bg-white text-red-600 font-semibold rounded-xl"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Camera View */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 safe-top flex items-center justify-between">
          <Link
            href="/home"
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-semibold text-white">QR 출근</h1>
          <div className="w-10" />
        </div>

        {/* Scan Area */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

              {/* Scanning line animation */}
              <div className="absolute inset-x-0 top-4 h-0.5 bg-primary animate-scan" />
            </div>
          </div>
        )}

        {/* Guide Text */}
        {status === 'scanning' && (
          <div className="absolute bottom-32 left-0 right-0 text-center">
            <p className="text-white text-lg mb-2">매장 QR 코드를 스캔하세요</p>
            {location && (
              <div className="flex items-center justify-center gap-1 text-white/70 text-sm">
                <MapPin className="w-4 h-4" />
                <span>위치 확인됨</span>
              </div>
            )}
          </div>
        )}

        {/* Demo Scan Button (for testing without actual QR) */}
        {status === 'scanning' && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center safe-bottom">
            <button
              onClick={handleScanDemo}
              className="px-8 py-4 bg-primary text-white font-semibold rounded-full shadow-lg"
            >
              출근하기 (데모)
            </button>
          </div>
        )}

        {renderContent()}
      </div>

      {/* CSS for scan animation */}
      <style jsx>{`
        @keyframes scan {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(240px);
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
