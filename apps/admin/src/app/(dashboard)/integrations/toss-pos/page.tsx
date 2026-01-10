'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Link2, Unlink } from 'lucide-react';

interface ConnectionStatus {
  connected: boolean;
  lastSyncedAt?: string;
  sourceId?: string;
}

export default function TossPOSIntegrationPage() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations/toss-pos/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    // OAuth 인증 페이지로 이동
    const state = crypto.randomUUID();
    sessionStorage.setItem('toss_oauth_state', state);

    const response = await fetch('/api/integrations/toss-pos/auth-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });

    if (response.ok) {
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('토스 POS 연결을 해제하시겠습니까?')) return;

    try {
      const response = await fetch('/api/integrations/toss-pos/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setStatus({ connected: false });
        alert('연결이 해제되었습니다.');
      }
    } catch (error) {
      alert('연결 해제에 실패했습니다.');
    }
  };

  const handleSync = async () => {
    if (!status.sourceId) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/integrations/toss-pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: status.sourceId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${result.syncedDays}일치 데이터가 동기화되었습니다.`);
        fetchConnectionStatus();
      } else {
        alert('동기화에 실패했습니다.');
      }
    } catch (error) {
      alert('동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return '없음';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">토스 POS 연동</h1>
        <p className="text-gray-600 mt-1">
          토스 POS와 연결하면 매출이 자동으로 집계됩니다.
        </p>
      </div>

      {/* 연결 상태 카드 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-8 h-8 text-blue-600"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">토스 POS</h3>
              <div className="flex items-center gap-2 mt-1">
                {status.connected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 text-sm">연결됨</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-sm">연결 안됨</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {status.connected ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '동기화 중...' : '지금 동기화'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Unlink className="h-4 w-4" />
                  연결 해제
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Link2 className="h-4 w-4" />
                토스 POS 연결하기
              </button>
            )}
          </div>
        </div>

        {status.connected && (
          <div className="mt-6 pt-6 border-t">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">마지막 동기화</dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">
                  {formatLastSync(status.lastSyncedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">자동 동기화</dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">
                  매시간 자동 동기화
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* 안내 사항 */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-3">연동 시 자동 수집되는 정보</h4>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            일별/시간대별 매출 데이터
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            카드/현금 결제 비율
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            거래 건수 통계
          </li>
        </ul>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">손익분석에 활용</h4>
          <p className="text-sm text-blue-700">
            수집된 매출 데이터는 비용 데이터와 함께 분석되어 자동 손익계산서를 생성합니다.
          </p>
        </div>
      </div>

      {/* 연동 가이드 */}
      {!status.connected && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="font-semibold text-gray-900 mb-4">연동 방법</h4>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-gray-700">
                &apos;토스 POS 연결하기&apos; 버튼을 클릭합니다.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-gray-700">
                토스 계정으로 로그인하고 데이터 제공에 동의합니다.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-gray-700">
                연결이 완료되면 매출 데이터가 자동으로 동기화됩니다.
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
