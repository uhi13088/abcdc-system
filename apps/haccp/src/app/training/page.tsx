'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Calendar, Award, BookOpen, CheckCircle, Clock } from 'lucide-react';

interface TrainingRecord {
  id: string;
  training_date: string;
  training_type: 'HACCP_BASIC' | 'HACCP_ADVANCED' | 'HYGIENE' | 'SAFETY' | 'CCP' | 'OTHER';
  title: string;
  instructor: string;
  duration_hours: number;
  attendees: Array<{
    employee_name: string;
    department: string;
    completed: boolean;
  }>;
  materials?: string;
  notes?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

export default function TrainingPage() {
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    training_type: 'HACCP_BASIC' as TrainingRecord['training_type'],
    title: '',
    instructor: '',
    duration_hours: 1,
    training_date: new Date().toISOString().split('T')[0],
    materials: '',
    notes: '',
  });

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    setLoading(true);
    // Simulated data
    setTimeout(() => {
      setTrainings([
        {
          id: '1',
          training_date: '2024-01-10',
          training_type: 'HACCP_BASIC',
          title: '2024년 HACCP 기본 교육',
          instructor: '품질관리팀장',
          duration_hours: 4,
          attendees: [
            { employee_name: '김철수', department: '생산팀', completed: true },
            { employee_name: '박영희', department: '품질팀', completed: true },
            { employee_name: '이민수', department: '생산팀', completed: true },
          ],
          materials: 'HACCP 기본교육 자료 v2024',
          status: 'COMPLETED',
        },
        {
          id: '2',
          training_date: '2024-02-15',
          training_type: 'CCP',
          title: 'CCP 모니터링 실무 교육',
          instructor: '외부강사 (한국식품안전협회)',
          duration_hours: 2,
          attendees: [
            { employee_name: '김철수', department: '생산팀', completed: true },
            { employee_name: '이민수', department: '생산팀', completed: false },
          ],
          materials: 'CCP 모니터링 매뉴얼',
          notes: '온도 측정 실습 포함',
          status: 'COMPLETED',
        },
        {
          id: '3',
          training_date: '2024-03-20',
          training_type: 'HYGIENE',
          title: '개인위생 및 손세척 교육',
          instructor: '품질관리팀',
          duration_hours: 1,
          attendees: [],
          status: 'SCHEDULED',
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTraining: TrainingRecord = {
      id: Date.now().toString(),
      training_date: formData.training_date,
      training_type: formData.training_type,
      title: formData.title,
      instructor: formData.instructor,
      duration_hours: formData.duration_hours,
      attendees: [],
      materials: formData.materials || undefined,
      notes: formData.notes || undefined,
      status: 'SCHEDULED',
    };
    setTrainings([newTraining, ...trainings]);
    setShowModal(false);
    setFormData({
      training_type: 'HACCP_BASIC',
      title: '',
      instructor: '',
      duration_hours: 1,
      training_date: new Date().toISOString().split('T')[0],
      materials: '',
      notes: '',
    });
  };

  const trainingTypeColors = {
    'HACCP_BASIC': 'bg-blue-100 text-blue-700',
    'HACCP_ADVANCED': 'bg-indigo-100 text-indigo-700',
    'HYGIENE': 'bg-green-100 text-green-700',
    'SAFETY': 'bg-red-100 text-red-700',
    'CCP': 'bg-orange-100 text-orange-700',
    'OTHER': 'bg-gray-100 text-gray-700',
  };

  const trainingTypeText = {
    'HACCP_BASIC': 'HACCP 기본',
    'HACCP_ADVANCED': 'HACCP 심화',
    'HYGIENE': '위생교육',
    'SAFETY': '안전교육',
    'CCP': 'CCP 관리',
    'OTHER': '기타',
  };

  const statusColors = {
    'SCHEDULED': 'bg-yellow-100 text-yellow-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-500',
  };

  const statusText = {
    'SCHEDULED': '예정',
    'COMPLETED': '완료',
    'CANCELLED': '취소',
  };

  const totalHours = trainings.filter(t => t.status === 'COMPLETED').reduce((acc, t) => acc + t.duration_hours, 0);
  const totalAttendees = trainings.reduce((acc, t) => acc + t.attendees.filter(a => a.completed).length, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 관리</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 및 위생 교육 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          교육 등록
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">전체 교육</p>
          </div>
          <p className="text-2xl font-bold">{trainings.length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-500">완료된 교육</p>
          </div>
          <p className="text-2xl font-bold">{trainings.filter(t => t.status === 'COMPLETED').length}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <p className="text-sm text-gray-500">총 교육 시간</p>
          </div>
          <p className="text-2xl font-bold">{totalHours}시간</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-orange-500" />
            <p className="text-sm text-gray-500">이수 인원</p>
          </div>
          <p className="text-2xl font-bold">{totalAttendees}명</p>
        </div>
      </div>

      {/* Training List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : trainings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">등록된 교육이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trainings.map((training) => (
            <div key={training.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${trainingTypeColors[training.training_type]}`}>
                    {trainingTypeText[training.training_type]}
                  </span>
                  <span className="text-sm text-gray-600">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {training.training_date}
                  </span>
                  <span className="text-sm text-gray-500">
                    {training.duration_hours}시간
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[training.status]}`}>
                  {statusText[training.status]}
                </span>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{training.title}</h3>
                <p className="text-sm text-gray-500 mb-3">강사: {training.instructor}</p>

                {training.materials && (
                  <p className="text-sm text-gray-600 mb-2">
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    교육자료: {training.materials}
                  </p>
                )}

                {training.notes && (
                  <p className="text-sm text-gray-500 mb-3">{training.notes}</p>
                )}

                {training.attendees.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      참석자 ({training.attendees.filter(a => a.completed).length}/{training.attendees.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {training.attendees.map((attendee, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs rounded ${
                            attendee.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {attendee.employee_name} ({attendee.department})
                          {attendee.completed && <CheckCircle className="w-3 h-3 inline ml-1" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
                <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">
                  수정
                </button>
                <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
                  참석자 관리
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">교육 등록</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교육 유형</label>
                  <select
                    value={formData.training_type}
                    onChange={(e) => setFormData({ ...formData, training_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="HACCP_BASIC">HACCP 기본</option>
                    <option value="HACCP_ADVANCED">HACCP 심화</option>
                    <option value="HYGIENE">위생교육</option>
                    <option value="SAFETY">안전교육</option>
                    <option value="CCP">CCP 관리</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교육일</label>
                  <input
                    type="date"
                    value={formData.training_date}
                    onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">교육명</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 2024년 HACCP 정기 교육"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">강사</label>
                  <input
                    type="text"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교육시간 (시간)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">교육자료</label>
                <input
                  type="text"
                  value={formData.materials}
                  onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

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
