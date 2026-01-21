'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Camera, MapPin, Loader2, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatLocalDate } from '@/lib/utils';

type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface MissedShift {
  work_date: string;
  start_time: string;
  end_time: string;
}

interface CheckinResult {
  success: boolean;
  message: string;
  checkInTime?: string;
  isLate?: boolean;
  storeName?: string;
  isCheckOut?: boolean;
  isUnscheduled?: boolean;
  missedShifts?: MissedShift[];
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

  // 결근 사유 모달 상태
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [missedShifts, setMissedShifts] = useState<MissedShift[]>([]);
  const [selectedMissedDate, setSelectedMissedDate] = useState<string>('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceCategory, setAbsenceCategory] = useState<'SICK' | 'FAMILY' | 'PERSONAL' | 'OTHER'>('OTHER');
  const [submittingExcuse, setSubmittingExcuse] = useState(false);

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

      // Fetch today's most recent attendance (use userData.id as staff_id)
      // Get the latest record to support multiple check-ins per day
      const today = formatLocalDate(new Date());
      if (userData) {
        const { data: attendanceData } = await supabase
          .from('attendances')
          .select('id, actual_check_in, actual_check_out')
          .eq('staff_id', userData.id)
          .eq('work_date', today)
          .order('actual_check_in', { ascending: false })
          .limit(1)
          .maybeSingle();

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
      const timeDisplay = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Determine if this is check-in or check-out
      const isCheckOut = todayAttendance?.actual_check_in && !todayAttendance?.actual_check_out;

      if (isCheckOut && todayAttendance) {
        // Check out - use check-out API
        const response = await fetch('/api/attendances/check-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '퇴근 처리에 실패했습니다.');
        }

        setResult({
          success: true,
          message: '퇴근이 완료되었습니다.',
          checkInTime: timeDisplay,
          isLate: false,
          storeName: userInfo.stores?.name || '매장',
          isCheckOut: true,
        });
        setStatus('success');
      } else {
        // Check in - use check-in API
        const response = await fetch('/api/attendances/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '출근 처리에 실패했습니다.');
        }

        const data = await response.json();
        const isReCheckIn = todayAttendance?.actual_check_in && todayAttendance?.actual_check_out;

        setResult({
          success: true,
          message: data.status_message || (isReCheckIn ? '재출근이 완료되었습니다.' : '출근이 완료되었습니다.'),
          checkInTime: timeDisplay,
          isLate: data.status === 'LATE',
          storeName: userInfo.stores?.name || '매장',
          isCheckOut: false,
          isUnscheduled: data.is_unscheduled,
          missedShifts: data.missed_shifts,
        });

        // Update local state for immediate UI feedback
        setTodayAttendance({
          id: data.id || '',
          actual_check_in: data.actual_check_in,
          actual_check_out: null,
        });

        setStatus('success');

        // 결근 내역이 있으면 모달 표시
        if (data.missed_shifts && data.missed_shifts.length > 0) {
          setMissedShifts(data.missed_shifts);
          setSelectedMissedDate(data.missed_shifts[0].work_date);
          // 성공 화면 표시 후 모달 표시
          setTimeout(() => {
            setShowAbsenceModal(true);
          }, 1500);
          return; // Don't auto-redirect when there are missed shifts
        }
      }

      // Vibration feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate([100]);
      }

      // Auto redirect after success (only if no missed shifts)
      setTimeout(() => {
        router.push('/home');
      }, 2000);
    } catch (error) {
      console.error('Check in/out error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
      });
      setStatus('error');

      // Vibration feedback for error
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  // 결근 사유 제출
  const handleSubmitAbsenceExcuse = async () => {
    if (!selectedMissedDate || !absenceReason.trim()) {
      alert('날짜와 사유를 입력해주세요.');
      return;
    }

    setSubmittingExcuse(true);
    try {
      const response = await fetch('/api/attendances/absence-excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: selectedMissedDate,
          reason: absenceReason,
          category: absenceCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '사유 제출에 실패했습니다.');
      }

      // 제출 완료 - 다음 결근 날짜가 있으면 계속, 없으면 모달 닫기
      const remainingShifts = missedShifts.filter(s => s.work_date !== selectedMissedDate);
      if (remainingShifts.length > 0) {
        setMissedShifts(remainingShifts);
        setSelectedMissedDate(remainingShifts[0].work_date);
        setAbsenceReason('');
        setAbsenceCategory('OTHER');
        alert('사유가 제출되었습니다. 다른 결근 날짜의 사유도 입력해주세요.');
      } else {
        setShowAbsenceModal(false);
        alert('모든 결근 사유가 제출되었습니다.');
        router.push('/home');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '사유 제출에 실패했습니다.');
    } finally {
      setSubmittingExcuse(false);
    }
  };

  // 결근 사유 입력 건너뛰기
  const handleSkipAbsenceExcuse = () => {
    if (confirm('결근 사유를 나중에 입력하시겠습니까?\n입력하지 않으면 무단결근으로 처리될 수 있습니다.')) {
      setShowAbsenceModal(false);
      router.push('/home');
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
      return '재출근하기';
    }
    if (todayAttendance?.actual_check_in) {
      return '퇴근하기';
    }
    return '출근하기';
  };

  const getButtonColor = () => {
    if (todayAttendance?.actual_check_in && todayAttendance?.actual_check_out) {
      return 'bg-blue-500 text-white'; // Re-check-in
    }
    if (todayAttendance?.actual_check_in) {
      return 'bg-red-500 text-white'; // Check-out
    }
    return 'bg-primary text-white'; // Check-in
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
              className={`px-8 py-4 font-semibold rounded-full shadow-lg ${getButtonColor()}`}
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

      {/* 결근 사유 입력 모달 */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
                <h2 className="text-lg font-bold text-gray-900">결근 사유 입력</h2>
              </div>
              <button
                onClick={handleSkipAbsenceExcuse}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              아래 날짜에 출근하지 않으셨습니다. 사유를 입력해주세요.
              {missedShifts.length > 1 && (
                <span className="text-orange-600 font-medium"> ({missedShifts.length}건)</span>
              )}
            </p>

            {/* 날짜 선택 (여러 건일 경우) */}
            {missedShifts.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날짜 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {missedShifts.map((shift) => (
                    <button
                      key={shift.work_date}
                      onClick={() => setSelectedMissedDate(shift.work_date)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedMissedDate === shift.work_date
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {new Date(shift.work_date).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 선택된 날짜 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-500">결근 날짜</p>
              <p className="font-semibold text-gray-900">
                {new Date(selectedMissedDate).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </p>
              {missedShifts.find(s => s.work_date === selectedMissedDate) && (
                <p className="text-sm text-gray-500 mt-1">
                  예정 근무: {new Date(missedShifts.find(s => s.work_date === selectedMissedDate)!.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {new Date(missedShifts.find(s => s.work_date === selectedMissedDate)!.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* 사유 카테고리 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사유 분류
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'SICK', label: '병가' },
                  { value: 'FAMILY', label: '경조사' },
                  { value: 'PERSONAL', label: '개인사유' },
                  { value: 'OTHER', label: '기타' },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setAbsenceCategory(cat.value as typeof absenceCategory)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      absenceCategory === cat.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 사유 입력 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상세 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                placeholder="결근 사유를 상세히 입력해주세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleSkipAbsenceExcuse}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                나중에
              </button>
              <button
                onClick={handleSubmitAbsenceExcuse}
                disabled={submittingExcuse || !absenceReason.trim()}
                className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submittingExcuse ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  '제출하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
