'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, AlertTriangle, Clock, Users, DollarSign, X } from 'lucide-react';
import { DEFAULT_MINIMUM_WAGE } from '@abc/shared';

interface Store {
  id: string;
  name: string;
}

interface EmergencyShift {
  id: string;
  store_id: string;
  store_name?: string;
  work_date: string;
  start_time: string;
  end_time: string;
  position: string;
  required_count: number;
  hourly_rate: number;
  bonus: number | null;
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
  deadline: string | null;
  applicants: { staff_id: string; staff_name: string; status: string }[];
  created_at: string;
}

const statusConfig = {
  OPEN: { label: '모집중', color: 'bg-green-100 text-green-800' },
  FILLED: { label: '모집완료', color: 'bg-blue-100 text-blue-800' },
  CANCELLED: { label: '취소됨', color: 'bg-gray-100 text-gray-800' },
};

export default function EmergencyPage() {
  const [shifts, setShifts] = useState<EmergencyShift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    store_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '18:00',
    position: '',
    required_count: 1,
    hourly_rate: DEFAULT_MINIMUM_WAGE,
    bonus: 0,
    deadline: '',
  });

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/emergency-shifts');
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error) {
      console.error('Failed to fetch emergency shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.store_id) {
      alert('매장을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/emergency-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchShifts();
        setFormData({
          store_id: '',
          work_date: format(new Date(), 'yyyy-MM-dd'),
          start_time: '09:00',
          end_time: '18:00',
          position: '',
          required_count: 1,
          hourly_rate: DEFAULT_MINIMUM_WAGE,
          bonus: 0,
          deadline: '',
        });
      } else {
        const error = await response.json();
        alert(error.error || '긴급 근무 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create emergency shift:', error);
      alert('긴급 근무 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">긴급 근무</h1>
          <p className="mt-1 text-sm text-gray-500">긴급 근무 요청을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          긴급 근무 등록
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600">모집중</span>
          </div>
          <p className="text-2xl font-bold">{shifts.filter(s => s.status === 'OPEN').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">모집완료</span>
          </div>
          <p className="text-2xl font-bold">{shifts.filter(s => s.status === 'FILLED').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-600">이번 주</span>
          </div>
          <p className="text-2xl font-bold">{shifts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">평균 시급</span>
          </div>
          <p className="text-2xl font-bold">
            {shifts.length > 0
              ? Math.round(shifts.reduce((acc, s) => acc + s.hourly_rate, 0) / shifts.length).toLocaleString()
              : 0}원
          </p>
        </div>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {shifts.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">등록된 긴급 근무가 없습니다</p>
            </div>
          ) : (
            shifts.map((shift) => (
              <div key={shift.id} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[shift.status].color}`}>
                        {statusConfig[shift.status].label}
                      </span>
                      <span className="text-sm text-gray-500">
                        {format(new Date(shift.work_date), 'M월 d일 (E)', { locale: ko })}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {shift.position || '포지션 미정'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {shift.store_name || '매장'} · {shift.start_time} ~ {shift.end_time}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <strong className="text-gray-900">{shift.hourly_rate.toLocaleString()}원</strong>/시간
                      </span>
                      {shift.bonus && shift.bonus > 0 && (
                        <span className="text-red-600">
                          +{shift.bonus.toLocaleString()}원 보너스
                        </span>
                      )}
                      <span className="text-gray-600">
                        필요 인원: <strong>{shift.required_count}명</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {shift.deadline && (
                      <p className="text-xs text-gray-500 mb-2">
                        마감: {format(new Date(shift.deadline), 'M/d HH:mm')}
                      </p>
                    )}
                    <p className="text-sm">
                      지원자 <strong className="text-blue-600">{shift.applicants?.length || 0}</strong>명
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">긴급 근무 등록</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 매장 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  매장 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">매장을 선택하세요</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">근무일</label>
                  <input
                    type="date"
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">포지션</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">선택하세요</option>
                    <option value="홀">홀</option>
                    <option value="주방">주방</option>
                    <option value="계산">계산</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시급</label>
                  <input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">보너스</label>
                  <input
                    type="number"
                    value={formData.bonus}
                    onChange={(e) => setFormData({ ...formData, bonus: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">필요 인원</label>
                <input
                  type="number"
                  value={formData.required_count}
                  onChange={(e) => setFormData({ ...formData, required_count: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={1}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
