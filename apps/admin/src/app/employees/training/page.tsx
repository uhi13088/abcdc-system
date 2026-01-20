'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, Award, Calendar, Clock, User, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Training {
  id: string;
  title: string;
  description: string;
  category: 'ONBOARDING' | 'SAFETY' | 'HACCP' | 'SERVICE' | 'SKILL' | 'COMPLIANCE';
  duration_hours: number;
  is_mandatory: boolean;
  valid_months?: number;
}

interface TrainingRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  training_id: string;
  training_title: string;
  training_category: string;
  completed_at: string;
  expires_at?: string;
  score?: number;
  certificate_url?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'EXPIRED';
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  ONBOARDING: 'bg-blue-100 text-blue-700',
  SAFETY: 'bg-red-100 text-red-700',
  HACCP: 'bg-green-100 text-green-700',
  SERVICE: 'bg-purple-100 text-purple-700',
  SKILL: 'bg-yellow-100 text-yellow-700',
  COMPLIANCE: 'bg-gray-100 text-gray-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  ONBOARDING: '신입교육',
  SAFETY: '안전교육',
  HACCP: 'HACCP',
  SERVICE: '서비스',
  SKILL: '직무역량',
  COMPLIANCE: '법정교육',
};

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<'records' | 'programs'>('records');
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [formData, setFormData] = useState({
    staff_id: '',
    training_id: '',
    completed_at: new Date().toISOString().split('T')[0],
    score: '',
  });

  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programFormData, setProgramFormData] = useState({
    title: '',
    description: '',
    category: 'ONBOARDING' as Training['category'],
    duration_hours: 1,
    is_mandatory: false,
    valid_months: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch trainings, records, and users in parallel
      const [trainingsRes, recordsRes, usersRes] = await Promise.all([
        fetch('/api/training'),
        fetch('/api/training/records'),
        fetch('/api/users?limit=100'),
      ]);

      const trainingsData = await trainingsRes.json();
      const recordsData = await recordsRes.json();
      const usersData = await usersRes.json();

      if (trainingsData.trainings) {
        setTrainings(trainingsData.trainings);
      }

      if (recordsData.records) {
        setRecords(recordsData.records);
      }

      if (usersData.data) {
        setUsers(usersData.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await fetch('/api/training/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.staff_id,
          training_id: formData.training_id,
          completed_at: formData.completed_at,
          score: formData.score ? parseInt(formData.score) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '교육 이수 등록에 실패했습니다.');
      }

      setShowModal(false);
      setFormData({
        staff_id: '',
        training_id: '',
        completed_at: new Date().toISOString().split('T')[0],
        score: '',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create record:', error);
      alert(error instanceof Error ? error.message : '교육 이수 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: programFormData.title,
          description: programFormData.description,
          category: programFormData.category,
          duration_hours: programFormData.duration_hours,
          is_mandatory: programFormData.is_mandatory,
          valid_months: programFormData.valid_months ? parseInt(programFormData.valid_months) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '교육 프로그램 등록에 실패했습니다.');
      }

      setShowProgramModal(false);
      setProgramFormData({
        title: '',
        description: '',
        category: 'ONBOARDING',
        duration_hours: 1,
        is_mandatory: false,
        valid_months: '',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create program:', error);
      alert(error instanceof Error ? error.message : '교육 프로그램 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: TrainingRecord['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'EXPIRED':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const filteredRecords = records.filter(r =>
    r.staff_name.includes(searchTerm) &&
    (categoryFilter === '' || r.training_category === categoryFilter)
  );

  const completedCount = records.filter(r => r.status === 'COMPLETED').length;
  const expiredCount = records.filter(r => r.status === 'EXPIRED').length;
  const mandatoryTrainings = trainings.filter(t => t.is_mandatory);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 관리</h1>
          <p className="mt-1 text-sm text-gray-500">직원 교육 이력 및 프로그램을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          교육 이수 등록
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 교육 프로그램</p>
              <p className="text-xl font-bold text-gray-900">{trainings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">이수 완료</p>
              <p className="text-xl font-bold text-gray-900">{completedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">만료됨</p>
              <p className="text-xl font-bold text-gray-900">{expiredCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">필수 교육</p>
              <p className="text-xl font-bold text-gray-900">{mandatoryTrainings.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'records'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            교육 이력
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'programs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            교육 프로그램
          </button>
        </div>

        {activeTab === 'records' && (
          <div className="p-4">
            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="직원 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">전체 카테고리</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Records Table */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">교육명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이수일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">만료일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">점수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="font-medium text-gray-900">{record.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.training_title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[record.training_category]}`}>
                          {CATEGORY_LABELS[record.training_category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.completed_at}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.expires_at || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {record.score ? `${record.score}점` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(record.status)}
                          <span className="text-sm text-gray-500">
                            {record.status === 'COMPLETED' ? '완료' : record.status === 'IN_PROGRESS' ? '진행중' : '만료'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'programs' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowProgramModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                교육 프로그램 추가
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainings.map((training) => (
                <div key={training.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[training.category]}`}>
                      {CATEGORY_LABELS[training.category]}
                    </span>
                    {training.is_mandatory && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">필수</span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{training.title}</h3>
                  <p className="text-sm text-gray-500 mb-3">{training.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {training.duration_hours}시간
                    </span>
                    {training.valid_months && (
                      <span>유효: {training.valid_months}개월</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">교육 이수 등록</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">직원 선택</label>
                <select
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">직원을 선택하세요</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">교육 프로그램</label>
                <select
                  value={formData.training_id}
                  onChange={(e) => setFormData({ ...formData, training_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">교육을 선택하세요</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({CATEGORY_LABELS[t.category]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이수일</label>
                  <input
                    type="date"
                    value={formData.completed_at}
                    onChange={(e) => setFormData({ ...formData, completed_at: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">점수 (선택)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="0-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Program Modal */}
      {showProgramModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">교육 프로그램 추가</h2>
              <button onClick={() => setShowProgramModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProgramSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">교육명</label>
                <input
                  type="text"
                  value={programFormData.title}
                  onChange={(e) => setProgramFormData({ ...programFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="교육 프로그램 이름"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={programFormData.description}
                  onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="교육 내용에 대한 설명"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={programFormData.category}
                    onChange={(e) => setProgramFormData({ ...programFormData, category: e.target.value as Training['category'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교육 시간</label>
                  <input
                    type="number"
                    min="1"
                    value={programFormData.duration_hours}
                    onChange={(e) => setProgramFormData({ ...programFormData, duration_hours: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="시간"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유효 기간 (개월)</label>
                  <input
                    type="number"
                    min="1"
                    value={programFormData.valid_months}
                    onChange={(e) => setProgramFormData({ ...programFormData, valid_months: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="비워두면 무기한"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={programFormData.is_mandatory}
                      onChange={(e) => setProgramFormData({ ...programFormData, is_mandatory: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">필수 교육</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={submitting}
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
