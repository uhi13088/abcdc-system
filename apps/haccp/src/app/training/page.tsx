'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Calendar, Award, BookOpen, CheckCircle, Clock, X, Edit2, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';

interface Attendee {
  user_id?: string;
  employee_name: string;
  department: string;
  completed: boolean;
  signature_url?: string;
}

interface TrainingRecord {
  id: string;
  training_date: string;
  training_type: 'HACCP_BASIC' | 'HACCP_ADVANCED' | 'HYGIENE' | 'SAFETY' | 'CCP' | 'OTHER';
  title: string;
  instructor: string;
  instructor_company?: string;
  duration_hours: number;
  location?: string;
  materials?: string;
  content_summary?: string;
  attendees: Attendee[];
  notes?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  created_by_name?: string;
  verified_by_name?: string;
  verified_at?: string;
}

export default function TrainingPage() {
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingRecord | null>(null);
  const [formData, setFormData] = useState({
    training_type: 'HACCP_BASIC' as TrainingRecord['training_type'],
    title: '',
    instructor: '',
    instructor_company: '',
    duration_hours: 1,
    training_date: new Date().toISOString().split('T')[0],
    location: '',
    materials: '',
    content_summary: '',
    notes: '',
  });
  const [attendeeForm, setAttendeeForm] = useState({
    employee_name: '',
    department: '',
  });

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/training');
      if (response.ok) {
        const data = await response.json();
        setTrainings(data);
      }
    } catch (error) {
      console.error('Failed to fetch trainings:', error);
      toast.error('교육 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMode ? 'PUT' : 'POST';
      const body = editMode
        ? { id: selectedTraining?.id, ...formData }
        : formData;

      const response = await fetch('/api/haccp/training', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchTrainings();
        resetForm();
        toast.success(editMode ? '교육이 수정되었습니다' : '교육이 등록되었습니다');
      }
    } catch (error) {
      console.error('Failed to save training:', error);
      toast.error('교육 저장에 실패했습니다');
    }
  };

  const resetForm = () => {
    setFormData({
      training_type: 'HACCP_BASIC',
      title: '',
      instructor: '',
      instructor_company: '',
      duration_hours: 1,
      training_date: new Date().toISOString().split('T')[0],
      location: '',
      materials: '',
      content_summary: '',
      notes: '',
    });
    setEditMode(false);
    setSelectedTraining(null);
  };

  const handleEdit = (training: TrainingRecord) => {
    setSelectedTraining(training);
    setFormData({
      training_type: training.training_type,
      title: training.title,
      instructor: training.instructor,
      instructor_company: training.instructor_company || '',
      duration_hours: training.duration_hours,
      training_date: training.training_date,
      location: training.location || '',
      materials: training.materials || '',
      content_summary: training.content_summary || '',
      notes: training.notes || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleStatusChange = async (training: TrainingRecord, newStatus: TrainingRecord['status']) => {
    try {
      const response = await fetch('/api/haccp/training', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: training.id, status: newStatus }),
      });

      if (response.ok) {
        fetchTrainings();
        toast.success('교육 상태가 변경되었습니다');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('교육 상태 변경에 실패했습니다');
    }
  };

  const handleAddAttendee = async () => {
    if (!selectedTraining || !attendeeForm.employee_name) return;

    const newAttendee: Attendee = {
      employee_name: attendeeForm.employee_name,
      department: attendeeForm.department,
      completed: false,
    };

    const updatedAttendees = [...(selectedTraining.attendees || []), newAttendee];

    try {
      const response = await fetch('/api/haccp/training', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTraining.id, attendees: updatedAttendees }),
      });

      if (response.ok) {
        fetchTrainings();
        setAttendeeForm({ employee_name: '', department: '' });
        // Update selectedTraining for UI
        setSelectedTraining({ ...selectedTraining, attendees: updatedAttendees });
        toast.success('참석자가 추가되었습니다');
      }
    } catch (error) {
      console.error('Failed to add attendee:', error);
      toast.error('참석자 추가에 실패했습니다');
    }
  };

  const handleToggleAttendeeComplete = async (attendeeIndex: number) => {
    if (!selectedTraining) return;

    const updatedAttendees = selectedTraining.attendees.map((a, i) =>
      i === attendeeIndex ? { ...a, completed: !a.completed } : a
    );

    try {
      const response = await fetch('/api/haccp/training', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTraining.id, attendees: updatedAttendees }),
      });

      if (response.ok) {
        fetchTrainings();
        setSelectedTraining({ ...selectedTraining, attendees: updatedAttendees });
        toast.success('참석자 이수 상태가 변경되었습니다');
      }
    } catch (error) {
      console.error('Failed to update attendee:', error);
      toast.error('참석자 상태 변경에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/haccp/training?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('교육 기록이 삭제되었습니다.');
        setDeleteTarget(null);
        fetchTrainings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '교육 기록 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete training:', error);
      toast.error('교육 기록 삭제에 실패했습니다.');
    }
  };

  const trainingTypeColors: Record<string, string> = {
    'HACCP_BASIC': 'bg-blue-100 text-blue-700',
    'HACCP_ADVANCED': 'bg-indigo-100 text-indigo-700',
    'HYGIENE': 'bg-green-100 text-green-700',
    'SAFETY': 'bg-red-100 text-red-700',
    'CCP': 'bg-orange-100 text-orange-700',
    'OTHER': 'bg-gray-100 text-gray-700',
  };

  const trainingTypeText: Record<string, string> = {
    'HACCP_BASIC': 'HACCP 기본',
    'HACCP_ADVANCED': 'HACCP 심화',
    'HYGIENE': '위생교육',
    'SAFETY': '안전교육',
    'CCP': 'CCP 관리',
    'OTHER': '기타',
  };

  const statusColors: Record<string, string> = {
    'SCHEDULED': 'bg-yellow-100 text-yellow-700',
    'COMPLETED': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-gray-100 text-gray-500',
  };

  const statusText: Record<string, string> = {
    'SCHEDULED': '예정',
    'COMPLETED': '완료',
    'CANCELLED': '취소',
  };

  const totalHours = trainings.filter(t => t.status === 'COMPLETED').reduce((acc, t) => acc + t.duration_hours, 0);
  const totalAttendees = trainings.reduce((acc, t) => acc + (t.attendees || []).filter(a => a.completed).length, 0);

  // 자동 입력 핸들러
  const handleAutoFill = () => {
    const trainingTypes = ['HACCP_BASIC', 'HACCP_ADVANCED', 'HYGIENE', 'SAFETY', 'CCP'] as const;
    const trainingTitles: Record<string, string[]> = {
      'HACCP_BASIC': ['HACCP 기본 교육', 'HACCP 시스템 이해 교육', 'HACCP 입문 과정'],
      'HACCP_ADVANCED': ['HACCP 심화 교육', 'HACCP 전문가 과정', 'HACCP 팀장 교육'],
      'HYGIENE': ['개인위생 관리 교육', '식품위생 교육', '위생관리 실무 교육'],
      'SAFETY': ['산업안전 교육', '안전보건 교육', '작업장 안전 교육'],
      'CCP': ['CCP 모니터링 교육', 'CCP 관리 실무', '한계기준 관리 교육'],
    };
    const instructors = ['김영수', '이정민', '박서연', '최현우', '정다은'];
    const instructorCompanies = ['', '한국식품안전관리원', 'HACCP교육원', '품질관리연구소', ''];
    const locations = ['대회의실', '교육장 A', '본사 세미나실', '품질관리팀 회의실', '온라인'];

    const randomType = trainingTypes[Math.floor(Math.random() * trainingTypes.length)];
    const titles = trainingTitles[randomType];
    const randomTitle = titles[Math.floor(Math.random() * titles.length)];
    const randomInstructorIdx = Math.floor(Math.random() * instructors.length);

    const today = new Date();
    const year = today.getFullYear();

    setFormData({
      training_type: randomType,
      title: `${year}년 ${randomTitle}`,
      instructor: instructors[randomInstructorIdx],
      instructor_company: instructorCompanies[randomInstructorIdx],
      duration_hours: [1, 2, 2, 3, 4][Math.floor(Math.random() * 5)],
      training_date: today.toISOString().split('T')[0],
      location: locations[Math.floor(Math.random() * locations.length)],
      materials: 'HACCP 교육 교재, 실습 자료, 평가지',
      content_summary: `${randomTitle}에 대한 이론 및 실무 교육 진행. 주요 내용: 식품안전관리 기본 원칙, 위해요소 분석 방법, 관리기준 설정 및 모니터링 절차 등.`,
      notes: '교육 완료 후 평가 실시 예정',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 관리</h1>
          <p className="mt-1 text-sm text-gray-500">HACCP 및 위생 교육 기록을 관리합니다</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
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
                <p className="text-sm text-gray-500 mb-3">
                  강사: {training.instructor}
                  {training.instructor_company && ` (${training.instructor_company})`}
                </p>

                {training.location && (
                  <p className="text-sm text-gray-600 mb-2">장소: {training.location}</p>
                )}

                {training.materials && (
                  <p className="text-sm text-gray-600 mb-2">
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    교육자료: {training.materials}
                  </p>
                )}

                {training.notes && (
                  <p className="text-sm text-gray-500 mb-3">{training.notes}</p>
                )}

                {(training.attendees || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      참석자 ({(training.attendees || []).filter(a => a.completed).length}/{(training.attendees || []).length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(training.attendees || []).map((attendee, idx) => (
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

              <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
                <div className="flex gap-2">
                  {training.status === 'SCHEDULED' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(training, 'COMPLETED')}
                        className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded"
                      >
                        완료 처리
                      </button>
                      <button
                        onClick={() => handleStatusChange(training, 'CANCELLED')}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(training)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    수정
                  </button>
                  <button
                    onClick={() => setDeleteTarget(training)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTraining(training);
                      setShowAttendeeModal(true);
                    }}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    참석자 관리
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">교육 기록 삭제</h3>
            <p className="text-gray-600 mb-4">
              정말로 이 교육 기록을 삭제하시겠습니까?<br/>
              <span className="text-sm text-gray-500">
                {deleteTarget.title} ({deleteTarget.training_date})
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editMode ? '교육 수정' : '교육 등록'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
              >
                ✨ 자동 입력 (샘플 데이터)
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>교육 유형</Label>
                  <select
                    value={formData.training_type}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                  <Label required>교육일</Label>
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
                <Label required>교육명</Label>
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
                  <Label required>강사</Label>
                  <input
                    type="text"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <Label>강사 소속</Label>
                  <input
                    type="text"
                    value={formData.instructor_company}
                    onChange={(e) => setFormData({ ...formData, instructor_company: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="외부강사의 경우"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>교육시간 (시간)</Label>
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
                <div>
                  <Label>교육 장소</Label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label>교육자료</Label>
                <input
                  type="text"
                  value={formData.materials}
                  onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <Label>교육 내용 요약</Label>
                <textarea
                  value={formData.content_summary}
                  onChange={(e) => setFormData({ ...formData, content_summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <Label>비고</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editMode ? '수정' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendee Management Modal */}
      {showAttendeeModal && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">참석자 관리</h2>
              <button onClick={() => setShowAttendeeModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{selectedTraining.title}</p>

            {/* Add Attendee Form */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-medium mb-3">참석자 추가</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="이름"
                  value={attendeeForm.employee_name}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, employee_name: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="부서"
                  value={attendeeForm.department}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, department: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleAddAttendee}
                disabled={!attendeeForm.employee_name}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>

            {/* Attendee List */}
            <div className="space-y-2">
              {(selectedTraining.attendees || []).length === 0 ? (
                <p className="text-gray-500 text-center py-4">등록된 참석자가 없습니다</p>
              ) : (
                (selectedTraining.attendees || []).map((attendee, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{attendee.employee_name}</p>
                      <p className="text-sm text-gray-500">{attendee.department}</p>
                    </div>
                    <button
                      onClick={() => handleToggleAttendeeComplete(idx)}
                      className={`px-3 py-1 text-sm rounded ${
                        attendee.completed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {attendee.completed ? '이수 완료' : '미이수'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowAttendeeModal(false)}
              className="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
