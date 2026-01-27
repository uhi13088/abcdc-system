'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle,
  Circle,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Trash2,
} from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
  is_present: boolean;
  check_in_time?: string;
  status: string;
}

interface WorkersResponse {
  date: string;
  workers: Worker[];
  stats: {
    total: number;
    present: number;
    absent: number;
  };
}

interface TodoItem {
  id: string;
  content: string;
  description?: string;
  sort_order: number;
  is_required: boolean;
  is_completed: boolean;
  completed_by?: string;
  completed_at?: string;
  completed_by_user?: { name: string } | null;
}

interface DailyTodo {
  id: string;
  company_id: string;
  todo_date: string;
  title: string;
  description?: string;
  template_id?: string;
  status: string;
  created_by?: string;
  created_at: string;
  items: TodoItem[];
  template?: { name: string; category: string } | null;
  created_by_user?: { name: string } | null;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  items?: { id: string; content: string; description?: string; is_required: boolean }[];
}

export default function TodoPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState<WorkersResponse | null>(null);
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTodos, setExpandedTodos] = useState<Record<string, boolean>>({});
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: '', items: [''] });

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await fetch(`/api/haccp/workers/today?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (error) {
      console.error('Failed to fetch workers:', error);
    }
  }, [selectedDate]);

  const fetchTodos = useCallback(async () => {
    try {
      const response = await fetch(`/api/haccp/todos/daily?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
        // 기본적으로 모든 투두 확장
        const expanded: Record<string, boolean> = {};
        data.forEach((todo: DailyTodo) => {
          expanded[todo.id] = true;
        });
        setExpandedTodos(expanded);
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  }, [selectedDate]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/haccp/todos/templates?include_items=true');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchWorkers(), fetchTodos(), fetchTemplates()]);
      setLoading(false);
    };
    loadData();
  }, [fetchWorkers, fetchTodos]);

  const createTodoFromTemplate = async (templateId: string) => {
    try {
      const response = await fetch('/api/haccp/todos/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          date: selectedDate,
        }),
      });

      if (response.ok) {
        setShowTemplateModal(false);
        fetchTodos();
      } else {
        const error = await response.json();
        alert(error.error || '체크리스트 생성에 실패했습니다');
      }
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const toggleItemCompletion = async (todoId: string, itemId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/haccp/todos/daily/${todoId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          is_completed: !currentStatus,
        }),
      });

      if (response.ok) {
        fetchTodos();
      }
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const deleteTodo = async (todoId: string) => {
    if (!confirm('이 체크리스트를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/haccp/todos/daily/${todoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTodos();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim()) {
      alert('템플릿 이름을 입력하세요');
      return;
    }

    const items = newTemplate.items.filter(item => item.trim() !== '').map(content => ({ content }));
    if (items.length === 0) {
      alert('최소 1개 이상의 항목을 입력하세요');
      return;
    }

    try {
      const response = await fetch('/api/haccp/todos/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplate.name,
          description: newTemplate.description,
          category: newTemplate.category,
          items,
        }),
      });

      if (response.ok) {
        setShowCreateTemplateModal(false);
        setNewTemplate({ name: '', description: '', category: '', items: [''] });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage > 0) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const roleLabels: Record<string, string> = {
    admin: '관리자',
    manager: '매니저',
    verifier: '검증자',
    staff: '직원',
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">일일 업무 체크리스트</h1>
        <p className="mt-1 text-sm text-gray-500">당일 근무자 현황 및 업무 체크리스트 관리</p>
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
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setShowCreateTemplateModal(true)}
            className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-4 h-4" />
            템플릿 관리
          </button>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            체크리스트 생성
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workers Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">당일 근무자</h2>
              </div>

              {workers && (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-900">{workers.stats.total}</div>
                      <div className="text-xs text-gray-500">전체</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{workers.stats.present}</div>
                      <div className="text-xs text-green-600">출근</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{workers.stats.absent}</div>
                      <div className="text-xs text-red-600">미출근</div>
                    </div>
                  </div>

                  {/* Worker List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {workers.workers.map((worker) => (
                      <div
                        key={worker.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          worker.is_present ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          worker.is_present ? 'bg-green-200' : 'bg-gray-200'
                        }`}>
                          <User className={`w-5 h-5 ${worker.is_present ? 'text-green-700' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{worker.name}</div>
                          <div className="text-xs text-gray-500">{roleLabels[worker.role] || worker.role}</div>
                        </div>
                        <div className="text-right">
                          {worker.is_present ? (
                            <div className="text-sm text-green-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(worker.check_in_time)}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">미출근</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Todos Section */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {todos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">오늘의 체크리스트가 없습니다</p>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    템플릿에서 생성하기
                  </button>
                </div>
              ) : (
                todos.map((todo) => (
                  <div key={todo.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {/* Todo Header */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
                        todo.progress.percentage === 100 ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                      onClick={() => setExpandedTodos(prev => ({ ...prev, [todo.id]: !prev[todo.id] }))}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {todo.progress.percentage === 100 ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <Circle className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{todo.title}</h3>
                          {todo.template?.category && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                              {todo.template.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Progress */}
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(todo.progress.percentage)} transition-all`}
                              style={{ width: `${todo.progress.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 min-w-[4rem]">
                            {todo.progress.completed}/{todo.progress.total} ({todo.progress.percentage}%)
                          </span>
                        </div>
                        {expandedTodos[todo.id] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Todo Items */}
                    {expandedTodos[todo.id] && (
                      <div className="p-4">
                        <div className="space-y-2">
                          {todo.items
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  item.is_completed
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                }`}
                                onClick={() => toggleItemCompletion(todo.id, item.id, item.is_completed)}
                              >
                                <div className="flex-shrink-0">
                                  {item.is_completed ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className={`text-sm ${item.is_completed ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                                    {item.content}
                                  </span>
                                  {item.is_required && (
                                    <span className="ml-2 text-xs text-red-500">*필수</span>
                                  )}
                                </div>
                                {item.is_completed && item.completed_by_user && (
                                  <div className="text-xs text-gray-500">
                                    {item.completed_by_user.name} ({formatTime(item.completed_at)})
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>

                        {/* Delete Button */}
                        <div className="mt-4 pt-3 border-t flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTodo(todo.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">템플릿에서 체크리스트 생성</h2>

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">사용 가능한 템플릿이 없습니다</p>
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setShowCreateTemplateModal(true);
                  }}
                  className="text-blue-600 hover:underline"
                >
                  새 템플릿 만들기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg hover:border-blue-300 cursor-pointer"
                    onClick={() => createTodoFromTemplate(template.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{template.name}</h3>
                        {template.category && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {template.category}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {template.items?.length || 0}개 항목
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">새 템플릿 만들기</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 개장 준비 체크리스트"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 개장준비, 마감, 위생점검"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="템플릿에 대한 설명"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">체크 항목 *</label>
                <div className="space-y-2">
                  {newTemplate.items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const newItems = [...newTemplate.items];
                          newItems[index] = e.target.value;
                          setNewTemplate(prev => ({ ...prev, items: newItems }));
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg"
                        placeholder={`항목 ${index + 1}`}
                      />
                      {newTemplate.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = newTemplate.items.filter((_, i) => i !== index);
                            setNewTemplate(prev => ({ ...prev, items: newItems }));
                          }}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewTemplate(prev => ({ ...prev, items: [...prev.items, ''] }))}
                    className="w-full px-3 py-2 border border-dashed rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    + 항목 추가
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setNewTemplate({ name: '', description: '', category: '', items: [''] });
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={createTemplate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
