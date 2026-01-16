'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Camera, MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface CheckinResult {
  success: boolean;
  message: string;
  checkInTime?: string;
  isLate?: boolean;
  storeName?: string;
  isCheckOut?: boolean;
}

interface UserInfo {
  id: string;
  company_id: string | null;
  brand_id: string | null;
  store_id: string | null;
  stores: { id: string; name: string } | null;
}

interface AttendanceRecord {
  id: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
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
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);

  const supabase = createClient();

  const fetchUserData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Fetch user's store info (query by auth_id, not id)
      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id, brand_id, store_id, stores(id, name)')
        .eq('auth_id', authUser.id)
        .single();

      if (userData) {
        // Supabase returns relations as arrays, extract first element
        const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
        setUserInfo({
          id: userData.id,
          company_id: userData.company_id,
          brand_id: userData.brand_id,
          store_id: userData.store_id,
          stores: storeData || null,
        });
      }

      // Fetch today's attendance (use userData.id as staff_id)
      const today = new Date().toISOString().split('T')[0];
      if (userData) {
        const { data: attendanceData } = await supabase
          .from('attendances')
          .select('id, actual_check_in, actual_check_out')
          .eq('staff_id', userData.id)
          .eq('work_date', today)
          .single();

        if (attendanceData) {
          setTodayAttendance(attendanceData);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

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

  const handleCheckInOut = async () => {
    if (status !== 'scanning' || !userInfo) return;

    setStatus('processing');

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setResult({
          success: false,
          message: '로그인이 필요합니다.',
        });
        setStatus('error');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const timeDisplay = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Determine if this is check-in or check-out
      const isCheckOut = todayAttendance?.actual_check_in && !todayAttendance?.actual_check_out;

      if (isCheckOut && todayAttendance) {
        // Check out
        const { error } = await supabase
          .from('attendances')
          .update({ actual_check_out: now })
          .eq('id', todayAttendance.id);

        if (error) {
          throw error;
        }

        setResult({
          success: true,
          message: '퇴근이 완료되었습니다.',
          checkInTime: timeDisplay,
          isLate: false,
          storeName: userInfo.stores?.name || '매장',
          isCheckOut: true,
        });
      } else if (!todayAttendance?.actual_check_in) {
        // Check in (use userInfo.id which is staff_id, not authUser.id which is auth_id)
        const { error } = await supabase
          .from('attendances')
          .upsert({
            staff_id: userInfo.id,
            company_id: userInfo.company_id,
            brand_id: userInfo.brand_id,
            store_id: userInfo.store_id,
            work_date: today,
            actual_check_in: now,
            status: 'NORMAL',
            check_in_method: 'QR',
            check_in_lat: location?.lat,
            check_in_lng: location?.lng,
          });

        if (error) {
          throw error;
        }

        setResult({
          success: true,
          message: '출근이 완료되었습니다.',
          checkInTime: timeDisplay,
          isLate: false,
          storeName: userInfo.stores?.name || '매장',
          isCheckOut: false,
        });
      } else {
        // Already checked in and out
        setResult({
          success: false,
          message: '오늘 이미 출퇴근 처리가 완료되었습니다.',
        });
        setStatus('error');
        return;
      }

      setStatus('success');

      // Vibration feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate([100]);
      }

      // Auto redirect after success
      setTimeout(() => {
        router.push('/home');
      }, 2000);
    } catch (error) {
      console.error('Check in/out error:', error);
      setResult({
        success: false,
        message: '처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
      });
      setStatus('error');

      // Vibration feedback for error
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
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
          <p className="text-white text-lg font-medium">처리 중...</p>
        </div>
      );
    }

    if (status === 'success' && result) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-600 z-20 p-6">
          <CheckCircle className="w-20 h-20 text-white mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            {result.isCheckOut ? '퇴근 완료!' : '출근 완료!'}
          </h2>
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
          <h2 className="text-2xl font-bold text-white mb-2">처리 실패</h2>
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

  const getButtonText = () => {
    if (todayAttendance?.actual_check_in && todayAttendance?.actual_check_out) {
      return '근무 완료';
    }
    if (todayAttendance?.actual_check_in) {
      return '퇴근하기';
    }
    return '출근하기';
  };

  const isWorkComplete = Boolean(todayAttendance?.actual_check_in && todayAttendance?.actual_check_out);

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
          <h1 className="text-lg font-semibold text-white">QR 출퇴근</h1>
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
            <p className="text-white text-lg mb-2">
              {userInfo?.stores?.name ? `${userInfo.stores.name} QR 코드를 스캔하세요` : '매장 QR 코드를 스캔하세요'}
            </p>
            {location && (
              <div className="flex items-center justify-center gap-1 text-white/70 text-sm">
                <MapPin className="w-4 h-4" />
                <span>위치 확인됨</span>
              </div>
            )}
          </div>
        )}

        {/* Check In/Out Button */}
        {status === 'scanning' && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center safe-bottom">
            <button
              onClick={handleCheckInOut}
              disabled={isWorkComplete}
              className={`px-8 py-4 font-semibold rounded-full shadow-lg ${
                isWorkComplete
                  ? 'bg-gray-400 text-white'
                  : todayAttendance?.actual_check_in
                  ? 'bg-red-500 text-white'
                  : 'bg-primary text-white'
              }`}
            >
              {getButtonText()}
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
