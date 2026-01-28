'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Check,
  X,
  Users,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Worker {
  id: string;
  name: string;
  email: string;
  role: string;
  check_in: string | null;
  check_out: string | null;
  attendance_status: string;
}

interface TodoItem {
  id: string;
  content: string;
  sort_order: number;
  category: string | null;
  is_required: boolean;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completer_name: string | null;
  note: string | null;
}

interface DailyTodo {
  id: string;
  date: string;
  name: string;
  total_items: number;
  completed_items: number;
  progress: number;
  status: string;
  creator_name: string | null;
  items: TodoItem[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  items_count: number;
}

interface TemplateItem {
  id: string;
  content: string;
  sort_order: number;
  category: string | null;
  is_required: boolean;
}

interface UserInfo {
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼관리자',
  company_admin: '관리자',
  validator: '검증자',
  worker: '작업자',
  viewer: '조회자',
};

const CATEGORY_LABELS: Record<string, string> = {
  OPEN: '오픈 준비',
  CLOSE: '마감 정리',
  HYGIENE: '위생 점검',
  CUSTOM: '기타',
};

export default function TodoPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [dailyTodos, setDailyTodos] = useState<DailyTodo[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateTodoModal, setShowCreateTodoModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);

  // New template form
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('CUSTOM');
  const [newTemplateItems, setNewTemplateItems] = useState<string[]>(['']);

  // Error/Success message
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' });

  const canManageTodo = userInfo?.role &&
    ['validator', 'company_admin', 'super_admin'].includes(userInfo.role);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch user info
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserInfo({ role: userData.role });
      }

      // Fetch today's workers
      const workersRes = await fetch('/api/haccp/workers/today');
      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setWorkers(workersData.workers || []);
        setCheckedInCount(workersData.checked_in || 0);
      }

      // Fetch daily todos
      const todosRes = await fetch('/api/haccp/todo/daily');
      if (todosRes.ok) {
        const todosData = await todosRes.json();
        setDailyTodos(todosData);
        // Auto-expand active todos
        const activeIds = todosData
          .filter((t: DailyTodo) => t.status === 'ACTIVE')
          .map((t: DailyTodo) => t.id);
        setExpandedTodos(new Set(activeIds));
      }

      // Fetch templates
      const templatesRes = await fetch('/api/haccp/todo/templates');
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('체크리스트 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-dismiss message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const toggleTodo = (todoId: string) => {
    setExpandedTodos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(todoId)) {
        newSet.delete(todoId);
      } else {
        newSet.add(todoId);
      }
      return newSet;
    });
  };

  const handleCompleteItem = async (todoId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/haccp/todo/daily/${todoId}/items/${itemId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        toast.success('체크리스트 항목을 완료했습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to complete item:', error);
      toast.error('체크리스트 항목 완료에 실패했습니다.');
    }
  };

  const handleUncompleteItem = async (todoId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/haccp/todo/daily/${todoId}/items/${itemId}/complete`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('체크리스트 항목 완료를 취소했습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to uncomplete item:', error);
      toast.error('체크리스트 항목 완료 취소에 실패했습니다.');
    }
  };

  const handleSelectTemplate = async (template: Template) => {
    setSelectedTemplate(template);

    // Fetch template items
    const res = await fetch(`/api/haccp/todo/templates/${template.id}/items`);
    if (res.ok) {
      const items = await res.json();
      setTemplateItems(items);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const res = await fetch('/api/haccp/todo/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplate.id }),
      });

      if (res.ok) {
        setShowTemplateModal(false);
        setSelectedTemplate(null);
        setTemplateItems([]);
        setMessage({ type: 'success', text: '할 일이 추가되었습니다.' });
        toast.success('체크리스트가 추가되었습니다.');
        fetchData();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || '생성에 실패했습니다.' });
        toast.error(error.error || '체크리스트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      setMessage({ type: 'error', text: '템플릿 적용 중 오류가 발생했습니다.' });
      toast.error('체크리스트 템플릿 적용 중 오류가 발생했습니다.');
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName || newTemplateItems.filter(i => i.trim()).length === 0) {
      setMessage({ type: 'error', text: '템플릿 이름과 최소 1개 이상의 항목을 입력하세요.' });
      return;
    }

    try {
      const res = await fetch('/api/haccp/todo/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          category: newTemplateCategory,
          items: newTemplateItems
            .filter(i => i.trim())
            .map(content => ({ content: content.trim() })),
        }),
      });

      if (res.ok) {
        setShowCreateTodoModal(false);
        setNewTemplateName('');
        setNewTemplateCategory('CUSTOM');
        setNewTemplateItems(['']);
        setMessage({ type: 'success', text: '템플릿이 생성되었습니다.' });
        toast.success('체크리스트 템플릿이 생성되었습니다.');
        fetchData();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || '생성에 실패했습니다.' });
        toast.error(error.error || '체크리스트 템플릿 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      setMessage({ type: 'error', text: '템플릿 생성 중 오류가 발생했습니다.' });
      toast.error('체크리스트 템플릿 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('이 투두를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/haccp/todo/daily?id=${todoId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('체크리스트가 삭제되었습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
      toast.error('체크리스트 삭제에 실패했습니다.');
    }
  };

  const addNewItemField = () => {
    setNewTemplateItems([...newTemplateItems, '']);
  };

  const updateNewItem = (index: number, value: string) => {
    const updated = [...newTemplateItems];
    updated[index] = value;
    setNewTemplateItems(updated);
  };

  const removeNewItem = (index: number) => {
    setNewTemplateItems(newTemplateItems.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일일 업무 체크리스트</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {canManageTodo && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileText className="w-4 h-4" />
              템플릿 적용
            </button>
            <button
              onClick={() => setShowCreateTodoModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              새 템플릿
            </button>
          </div>
        )}
      </div>

      {/* Message Toast */}
      {message.text && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage({ type: '', text: '' })}
            className="ml-4 text-current opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workers Section */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">오늘의 근무자</h2>
          <span className="ml-auto text-sm text-gray-500">
            출근 {checkedInCount}명 / 전체 {workers.length}명
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                worker.check_in
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                worker.check_in ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="font-medium">{worker.name}</span>
              <span className="text-xs opacity-70">
                {ROLE_LABELS[worker.role] || worker.role}
              </span>
              {worker.check_in && (
                <span className="text-xs">
                  {new Date(worker.check_in).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Todos Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">오늘의 할 일</h2>
        </div>

        {dailyTodos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">오늘 등록된 할 일이 없습니다</p>
            {canManageTodo && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                템플릿에서 추가하기
              </button>
            )}
          </div>
        ) : (
          dailyTodos.map((todo) => (
            <div key={todo.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Todo Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleTodo(todo.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedTodos.has(todo.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{todo.name}</h3>
                      <p className="text-xs text-gray-500">
                        작성: {todo.creator_name || '알 수 없음'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {todo.progress}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {todo.completed_items}/{todo.total_items} 완료
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          todo.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${todo.progress}%` }}
                      />
                    </div>

                    {canManageTodo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTodo(todo.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Todo Items */}
              {expandedTodos.has(todo.id) && (
                <div className="border-t divide-y">
                  {todo.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 flex items-center gap-4 ${
                        item.is_completed ? 'bg-green-50' : ''
                      }`}
                    >
                      <button
                        onClick={() =>
                          item.is_completed
                            ? handleUncompleteItem(todo.id, item.id)
                            : handleCompleteItem(todo.id, item.id)
                        }
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                          item.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {item.is_completed && <Check className="w-5 h-5" />}
                      </button>

                      <div className="flex-1">
                        <p className={`${
                          item.is_completed ? 'line-through text-gray-400' : 'text-gray-900'
                        }`}>
                          {item.content}
                        </p>
                        {item.is_completed && item.completer_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {item.completer_name}이(가) 완료
                            {item.completed_at && ` (${new Date(item.completed_at).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })})`}
                          </p>
                        )}
                      </div>

                      {item.category && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          {item.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">템플릿 선택</h2>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setSelectedTemplate(null);
                  setTemplateItems([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">등록된 템플릿이 없습니다.</p>
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setShowCreateTodoModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    새 템플릿 만들기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{template.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {template.items_count}개 항목
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Template Preview */}
              {selectedTemplate && templateItems.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold mb-3">
                    {selectedTemplate.name} 미리보기
                  </h3>
                  <ul className="space-y-2">
                    {templateItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0" />
                        <span>{item.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setSelectedTemplate(null);
                  setTemplateItems([]);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                오늘 할 일로 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateTodoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">새 템플릿 만들기</h2>
              <button
                onClick={() => {
                  setShowCreateTodoModal(false);
                  setNewTemplateName('');
                  setNewTemplateCategory('CUSTOM');
                  setNewTemplateItems(['']);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  템플릿 이름
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 오픈 준비 체크리스트"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="OPEN">오픈 준비</option>
                  <option value="CLOSE">마감 정리</option>
                  <option value="HYGIENE">위생 점검</option>
                  <option value="CUSTOM">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  체크리스트 항목
                </label>
                <div className="space-y-2">
                  {newTemplateItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateNewItem(index, e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg"
                        placeholder={`항목 ${index + 1}`}
                      />
                      {newTemplateItems.length > 1 && (
                        <button
                          onClick={() => removeNewItem(index)}
                          className="p-2 hover:bg-red-100 rounded-lg"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addNewItemField}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  + 항목 추가
                </button>
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowCreateTodoModal(false);
                  setNewTemplateName('');
                  setNewTemplateCategory('CUSTOM');
                  setNewTemplateItems(['']);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateTemplate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                템플릿 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
