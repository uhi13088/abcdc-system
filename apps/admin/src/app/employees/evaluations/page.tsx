'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Star, User, Calendar, TrendingUp, Filter, X } from 'lucide-react';

interface Evaluation {
  id: string;
  staff_id: string;
  staff_name: string;
  evaluator_name: string;
  evaluation_period: string;
  evaluation_date: string;
  overall_score: number;
  categories: {
    attendance: number;
    performance: number;
    teamwork: number;
    initiative: number;
    skill: number;
  };
  strengths: string;
  improvements: string;
  goals: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
}

const RATING_LABELS = ['매우 미흡', '미흡', '보통', '우수', '매우 우수'];

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  const [formData, setFormData] = useState({
    staff_id: '',
    evaluation_period: `${new Date().getFullYear()}년 ${Math.ceil((new Date().getMonth() + 1) / 3)}분기`,
    categories: {
      attendance: 3,
      performance: 3,
      teamwork: 3,
      initiative: 3,
      skill: 3,
    },
    strengths: '',
    improvements: '',
    goals: '',
  });

  useEffect(() => {
    fetchEvaluations();
  }, [periodFilter]);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real API call
      const mockData: Evaluation[] = [
        {
          id: '1',
          staff_id: 'u1',
          staff_name: '김철수',
          evaluator_name: '박매니저',
          evaluation_period: '2024년 1분기',
          evaluation_date: '2024-01-10',
          overall_score: 4.2,
          categories: { attendance: 5, performance: 4, teamwork: 4, initiative: 4, skill: 4 },
          strengths: '성실한 근무 태도와 뛰어난 고객 응대 능력',
          improvements: '업무 우선순위 설정 능력 향상 필요',
          goals: 'Q2까지 POS 시스템 완벽 숙지, 신입 교육 담당',
          status: 'REVIEWED',
        },
        {
          id: '2',
          staff_id: 'u2',
          staff_name: '이영희',
          evaluator_name: '박매니저',
          evaluation_period: '2024년 1분기',
          evaluation_date: '2024-01-10',
          overall_score: 3.8,
          categories: { attendance: 4, performance: 4, teamwork: 3, initiative: 4, skill: 4 },
          strengths: '빠른 학습 능력과 적극적인 업무 태도',
          improvements: '팀 커뮤니케이션 스킬 향상 필요',
          goals: '주방 보조 업무 교차 훈련 완료',
          status: 'SUBMITTED',
        },
      ];
      setEvaluations(mockData);
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // TODO: Replace with real API call
      console.log('Creating evaluation:', formData);
      setShowModal(false);
      fetchEvaluations();
    } catch (error) {
      console.error('Failed to create evaluation:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600 bg-green-100';
    if (score >= 3.5) return 'text-blue-600 bg-blue-100';
    if (score >= 2.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusBadge = (status: Evaluation['status']) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-700',
      SUBMITTED: 'bg-yellow-100 text-yellow-700',
      REVIEWED: 'bg-green-100 text-green-700',
    };
    const labels = {
      DRAFT: '작성중',
      SUBMITTED: '제출됨',
      REVIEWED: '검토완료',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const renderStars = (score: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const filteredEvaluations = evaluations.filter(e =>
    e.staff_name.includes(searchTerm) &&
    (periodFilter === '' || e.evaluation_period === periodFilter)
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 평가</h1>
          <p className="mt-1 text-sm text-gray-500">분기별 직원 성과 평가를 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          새 평가 작성
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-4">
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
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">전체 기간</option>
            <option value="2024년 1분기">2024년 1분기</option>
            <option value="2023년 4분기">2023년 4분기</option>
            <option value="2023년 3분기">2023년 3분기</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 평가 수</p>
              <p className="text-xl font-bold text-gray-900">{evaluations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">평균 점수</p>
              <p className="text-xl font-bold text-gray-900">
                {evaluations.length > 0
                  ? (evaluations.reduce((sum, e) => sum + e.overall_score, 0) / evaluations.length).toFixed(1)
                  : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">우수 직원</p>
              <p className="text-xl font-bold text-gray-900">
                {evaluations.filter(e => e.overall_score >= 4).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">이번 분기</p>
              <p className="text-xl font-bold text-gray-900">
                {evaluations.filter(e => e.evaluation_period === '2024년 1분기').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluations List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredEvaluations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 평가가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvaluations.map((evaluation) => (
            <div key={evaluation.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{evaluation.staff_name}</h3>
                      <p className="text-sm text-gray-500">{evaluation.evaluation_period}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(evaluation.status)}
                    <span className={`px-3 py-1 text-lg font-bold rounded-lg ${getScoreColor(evaluation.overall_score)}`}>
                      {evaluation.overall_score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Category Scores */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {Object.entries(evaluation.categories).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      attendance: '출근',
                      performance: '성과',
                      teamwork: '협업',
                      initiative: '주도성',
                      skill: '역량',
                    };
                    return (
                      <div key={key} className="text-center">
                        <p className="text-xs text-gray-500 mb-1">{labels[key]}</p>
                        {renderStars(value)}
                      </div>
                    );
                  })}
                </div>

                {/* Feedback */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium mb-1">강점</p>
                    <p className="text-gray-700 line-clamp-2">{evaluation.strengths}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 font-medium mb-1">개선점</p>
                    <p className="text-gray-700 line-clamp-2">{evaluation.improvements}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium mb-1">목표</p>
                    <p className="text-gray-700 line-clamp-2">{evaluation.goals}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-sm text-gray-500">
                <span>평가자: {evaluation.evaluator_name}</span>
                <span>{evaluation.evaluation_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Evaluation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">직원 평가 작성</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">직원 선택</label>
                  <select
                    value={formData.staff_id}
                    onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">직원을 선택하세요</option>
                    <option value="u1">김철수</option>
                    <option value="u2">이영희</option>
                    <option value="u3">박지민</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">평가 기간</label>
                  <input
                    type="text"
                    value={formData.evaluation_period}
                    onChange={(e) => setFormData({ ...formData, evaluation_period: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Category Ratings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">항목별 평가</label>
                <div className="space-y-4">
                  {Object.entries(formData.categories).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      attendance: '출근/근태',
                      performance: '업무 성과',
                      teamwork: '팀워크/협업',
                      initiative: '주도성/적극성',
                      skill: '직무 역량',
                    };
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 w-32">{labels[key]}</span>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                categories: { ...formData.categories, [key]: score }
                              })}
                              className="p-1"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  score <= value
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300 hover:text-yellow-200'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {RATING_LABELS[value - 1]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">강점</label>
                <textarea
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="직원의 강점을 기록하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">개선점</label>
                <textarea
                  value={formData.improvements}
                  onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="개선이 필요한 부분을 기록하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">다음 분기 목표</label>
                <textarea
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="다음 분기 달성 목표를 기록하세요"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  임시저장
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  제출
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
