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
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completer_name: string | null;
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

interface Suggestion {
  id?: string;
  content: string;
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

export default function TodoPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [dailyTodos, setDailyTodos] = useState<DailyTodo[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');

  const canManageTodo = userInfo?.role &&
    ['validator', 'company_admin', 'super_admin'].includes(userInfo.role);

  // 오늘 날짜 포맷
  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserInfo({ role: userData.role });
      }

      const workersRes = await fetch('/api/haccp/workers/today');
      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setWorkers(workersData.workers || []);
        setCheckedInCount(workersData.checked_in || 0);
      }

      const todosRes = await fetch('/api/haccp/todo/daily');
      if (todosRes.ok) {
        const todosData = await todosRes.json();
        setDailyTodos(todosData);
        const activeIds = todosData
          .filter((t: DailyTodo) => t.status === 'ACTIVE')
          .map((t: DailyTodo) => t.id);
        setExpandedTodos(new Set(activeIds));
      }

      const suggestionsRes = await fetch('/api/haccp/todo/suggestions');
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        toast.success('완료');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to complete item:', error);
    }
  };

  const handleUncompleteItem = async (todoId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/haccp/todo/daily/${todoId}/items/${itemId}/complete`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to uncomplete item:', error);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/haccp/todo/daily?id=${todoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('삭제됨');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  // 모달 열기
  const openModal = () => {
    setPendingItems([]);
    setNewItemText('');
    setShowModal(true);
  };

  // 이전 항목 버튼 클릭 → 입력란에 채우기
  const handleSuggestionClick = (content: string) => {
    setNewItemText(content);
  };

  // 직접 입력 추가
  const handleAddItem = () => {
    const text = newItemText.trim();
    if (text && !pendingItems.includes(text)) {
      setPendingItems([...pendingItems, text]);
      setNewItemText('');
    }
  };

  // 항목 삭제
  const handleRemoveItem = (index: number) => {
    setPendingItems(pendingItems.filter((_, i) => i !== index));
  };

  // 체크리스트 등록
  const handleCreate = async () => {
    if (pendingItems.length === 0) {
      toast.error('항목을 추가하세요');
      return;
    }

    try {
      const res = await fetch('/api/haccp/todo/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: todayFormatted,
          items: pendingItems.map(content => ({ content })),
        }),
      });

      if (res.ok) {
        // suggestions에 등록
        for (const content of pendingItems) {
          await fetch('/api/haccp/todo/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
        }
        toast.success('등록 완료');
        setShowModal(false);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || '등록 실패');
      }
    } catch (error) {
      console.error('Failed to create:', error);
      toast.error('오류 발생');
    }
  };

  // 태그 삭제 (Optimistic update - 즉시 UI 반영)
  const handleDeleteSuggestion = (suggestion: Suggestion) => {
    // 즉시 UI에서 제거
    setSuggestions(prev => prev.filter(s =>
      suggestion.id ? s.id !== suggestion.id : s.content !== suggestion.content
    ));

    // 백그라운드에서 API 호출 (await 없이)
    const params = suggestion.id
      ? `id=${suggestion.id}`
      : `content=${encodeURIComponent(suggestion.content)}`;
    fetch(`/api/haccp/todo/suggestions?${params}`, { method: 'DELETE' })
      .catch(error => console.error('Failed to delete suggestion:', error));
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
          <p className="text-sm text-gray-500 mt-1">{todayFormatted}</p>
        </div>

        {canManageTodo && (
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            새 체크리스트 작성
          </button>
        )}
      </div>

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
                worker.check_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${worker.check_in ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="font-medium">{worker.name}</span>
              <span className="text-xs opacity-70">{ROLE_LABELS[worker.role] || worker.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Todos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">오늘의 체크리스트</h2>
        </div>

        {dailyTodos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">등록된 체크리스트가 없습니다</p>
            {canManageTodo && (
              <button
                onClick={openModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                체크리스트 작성하기
              </button>
            )}
          </div>
        ) : (
          dailyTodos.map((todo) => (
            <div key={todo.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
                      <p className="text-xs text-gray-500">작성: {todo.creator_name || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{todo.progress}%</div>
                      <div className="text-xs text-gray-500">{todo.completed_items}/{todo.total_items}</div>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${todo.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${todo.progress}%` }}
                      />
                    </div>
                    {canManageTodo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTodo(todo.id); }}
                        className="p-2 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {expandedTodos.has(todo.id) && (
                <div className="border-t divide-y">
                  {todo.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 flex items-center gap-4 ${item.is_completed ? 'bg-green-50' : ''}`}
                    >
                      <button
                        onClick={() =>
                          item.is_completed
                            ? handleUncompleteItem(todo.id, item.id)
                            : handleCompleteItem(todo.id, item.id)
                        }
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          item.is_completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {item.is_completed && <Check className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <p className={item.is_completed ? 'line-through text-gray-400' : ''}>
                          {item.content}
                        </p>
                        {item.is_completed && item.completer_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {item.completer_name}
                            {item.completed_at && ` (${new Date(item.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">새 체크리스트</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* 날짜 (자동) */}
              <div className="p-3 bg-blue-50 rounded-lg text-blue-800 font-medium">
                {todayFormatted}
              </div>

              {/* 이전에 사용한 항목 버튼들 */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">이전 항목 (클릭하여 추가)</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className="inline-flex items-center rounded-full text-sm bg-gray-100 text-gray-700"
                      >
                        <button
                          onClick={() => handleSuggestionClick(s.content)}
                          className="px-3 py-1.5 hover:bg-blue-100 rounded-l-full"
                        >
                          {s.content}
                        </button>
                        <button
                          onClick={() => handleDeleteSuggestion(s)}
                          className="pr-2 pl-1 py-1.5 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 직접 입력 */}
              <div>
                <p className="text-sm text-gray-600 mb-2">항목 입력</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    placeholder="내용 입력 후 Enter"
                  />
                  <button
                    onClick={handleAddItem}
                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 추가된 항목 목록 */}
              {pendingItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">추가된 항목 ({pendingItems.length})</p>
                  {pendingItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-sm">
                        {index + 1}
                      </span>
                      <span className="flex-1">{item}</span>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={pendingItems.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
