'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, Clock, User } from 'lucide-react';

interface HygieneCheck {
  id: string;
  check_date: string;
  shift: '오전' | '오후' | '야간';
  checked_by_name?: string;
  personal_hygiene: Record<string, boolean>;
  facility_hygiene: Record<string, boolean>;
  equipment_hygiene: Record<string, boolean>;
  material_management: Record<string, boolean>;
  overall_status: 'PASS' | 'FAIL';
  corrective_action?: string;
  verified_by_name?: string;
  verified_at?: string;
}

export default function HygienePage() {
  const [checks, setChecks] = useState<HygieneCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState<{
    shift: '오전' | '오후' | '야간';
    personal_hygiene: Record<string, boolean>;
    facility_hygiene: Record<string, boolean>;
    equipment_hygiene: Record<string, boolean>;
    material_management: Record<string, boolean>;
  }>({
    shift: '오전',
    personal_hygiene: {
      '작업복 청결': false,
      '위생모 착용': false,
      '위생화 청결': false,
      '손톱 상태': false,
      '손 세척/소독': false,
      '장신구 미착용': false,
    },
    facility_hygiene: {
      '바닥 청결': false,
      '벽면 청결': false,
      '배수구 청결': false,
      '조명 상태': false,
      '환기 상태': false,
    },
    equipment_hygiene: {
      '작업대 청결': false,
      '도구류 청결': false,
      '용기류 청결': false,
      '설비 청결': false,
    },
    material_management: {
      '원료 보관상태': false,
      '선입선출': false,
      '유통기한 확인': false,
      '온도 관리': false,
    },
  });

  useEffect(() => {
    fetchChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/haccp/hygiene?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setChecks(data);
      }
    } catch (error) {
      console.error('Failed to fetch hygiene checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allChecks = [
      ...Object.values(formData.personal_hygiene),
      ...Object.values(formData.facility_hygiene),
      ...Object.values(formData.equipment_hygiene),
      ...Object.values(formData.material_management),
    ];
    const overall_status = allChecks.every(v => v) ? 'PASS' : 'FAIL';

    try {
      const response = await fetch('/api/haccp/hygiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_date: selectedDate,
          ...formData,
          overall_status,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchChecks();
      }
    } catch (error) {
      console.error('Failed to create hygiene check:', error);
    }
  };

  const shiftColors = {
    '오전': 'bg-yellow-100 text-yellow-700',
    '오후': 'bg-blue-100 text-blue-700',
    '야간': 'bg-purple-100 text-purple-700',
  };

  const CheckSection = ({ title, items, category }: { title: string; items: Record<string, boolean>; category: 'personal_hygiene' | 'facility_hygiene' | 'equipment_hygiene' | 'material_management' }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(items).map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  [category]: {
                    ...prev[category],
                    [key]: e.target.checked,
                  },
                }));
              }}
              className="rounded text-blue-600"
            />
            <span className="text-sm">{key}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일일 위생점검</h1>
          <p className="mt-1 text-sm text-gray-500">일일 위생점검 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          점검 기록
        </button>
      </div>

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Checks */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : checks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">해당 날짜의 위생점검 기록이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {checks.map((check) => (
            <div key={check.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${
                check.overall_status === 'PASS' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${shiftColors[check.shift]}`}>
                    {check.shift}
                  </span>
                  {check.overall_status === 'PASS' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  check.overall_status === 'PASS' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {check.overall_status === 'PASS' ? '적합' : '부적합'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>점검자: {check.checked_by_name || '-'}</span>
                </div>

                {check.corrective_action && (
                  <div className="bg-yellow-50 rounded p-2">
                    <p className="text-xs font-medium text-yellow-800">개선조치</p>
                    <p className="text-sm text-yellow-700">{check.corrective_action}</p>
                  </div>
                )}

                {check.verified_by_name && (
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    검증: {check.verified_by_name} ({check.verified_at ? new Date(check.verified_at).toLocaleString('ko-KR') : ''})
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">위생점검 기록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">근무조</label>
                <div className="flex gap-2">
                  {(['오전', '오후', '야간'] as const).map((shift) => (
                    <button
                      key={shift}
                      type="button"
                      onClick={() => setFormData({ ...formData, shift })}
                      className={`px-4 py-2 rounded-lg ${
                        formData.shift === shift
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {shift}
                    </button>
                  ))}
                </div>
              </div>

              <CheckSection title="개인위생" items={formData.personal_hygiene} category="personal_hygiene" />
              <CheckSection title="시설위생" items={formData.facility_hygiene} category="facility_hygiene" />
              <CheckSection title="설비위생" items={formData.equipment_hygiene} category="equipment_hygiene" />
              <CheckSection title="원료관리" items={formData.material_management} category="material_management" />

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
