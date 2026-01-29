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
  Edit2,
  Tag,
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

interface Suggestion {
  id?: string;
  content: string;
  usage_count: number;
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

  // 체크리스트 작성 모드
  const [isCreating, setIsCreating] = useState(false);
  const [todoName, setTodoName] = useState('');
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  // 태그 관리 모드
  const [isManagingTags, setIsManagingTags] = useState(false);

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

      // Fetch suggestions (버튼 태그들)
      const suggestionsRes = await fetch('/api/haccp/todo/suggestions');
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
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
        toast.success('완료했습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to complete item:', error);
      toast.error('완료 처리에 실패했습니다.');
    }
  };

  const handleUncompleteItem = async (todoId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/haccp/todo/daily/${todoId}/items/${itemId}/complete`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('완료 취소했습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to uncomplete item:', error);
      toast.error('완료 취소에 실패했습니다.');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('이 체크리스트를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/haccp/todo/daily?id=${todoId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('삭제되었습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  // 태그 버튼 클릭 시 항목 추가
  const handleTagClick = (content: string) => {
    if (!pendingItems.includes(content)) {
      setPendingItems([...pendingItems, content]);
    }
  };

  // 직접 입력으로 항목 추가
  const handleAddItem = () => {
    const text = newItemText.trim();
    if (text && !pendingItems.includes(text)) {
      setPendingItems([...pendingItems, text]);
      setNewItemText('');
    }
  };

  // 항목 수정 시작
  const handleStartEdit = (index: number) => {
    setEditingItemIndex(index);
    setEditingItemText(pendingItems[index]);
  };

  // 항목 수정 완료
  const handleFinishEdit = () => {
    if (editingItemIndex !== null && editingItemText.trim()) {
      const updated = [...pendingItems];
      const newContent = editingItemText.trim();

      // 원래 내용과 다르면 수정
      if (updated[editingItemIndex] !== newContent) {
        updated[editingItemIndex] = newContent;
        setPendingItems(updated);
      }
    }
    setEditingItemIndex(null);
    setEditingItemText('');
  };

  // 항목 삭제
  const handleRemoveItem = (index: number) => {
    setPendingItems(pendingItems.filter((_, i) => i !== index));
  };

  // 체크리스트 생성
  const handleCreateTodo = async () => {
    if (!todoName.trim()) {
      toast.error('체크리스트 이름을 입력하세요.');
      return;
    }
    if (pendingItems.length === 0) {
      toast.error('최소 1개 이상의 항목을 추가하세요.');
      return;
    }

    try {
      const res = await fetch('/api/haccp/todo/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: todoName.trim(),
          items: pendingItems.map(content => ({ content })),
        }),
      });

      if (res.ok) {
        // 새로 추가된 항목들을 suggestions에 등록
        for (const content of pendingItems) {
          await fetch('/api/haccp/todo/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
        }

        toast.success('체크리스트가 생성되었습니다.');
        setIsCreating(false);
        setTodoName('');
        setPendingItems([]);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || '생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create todo:', error);
      toast.error('생성 중 오류가 발생했습니다.');
    }
  };

  // 태그 삭제
  const handleDeleteTag = async (id: string) => {
    try {
      const res = await fetch(`/api/haccp/todo/suggestions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('태그가 삭제되었습니다.');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('태그 삭제에 실패했습니다.');
    }
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

        {canManageTodo && !isCreating && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsManagingTags(!isManagingTags)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                isManagingTags
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Tag className="w-4 h-4" />
              태그 관리
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              체크리스트 작성
            </button>
          </div>
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

      {/* 체크리스트 작성 모드 */}
      {isCreating && canManageTodo && (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">새 체크리스트 작성</h2>
            <button
              onClick={() => {
                setIsCreating(false);
                setTodoName('');
                setPendingItems([]);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 체크리스트 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              체크리스트 이름
            </label>
            <input
              type="text"
              value={todoName}
              onChange={(e) => setTodoName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: 오픈 준비, 마감 체크"
            />
          </div>

          {/* 태그 버튼들 */}
          {suggestions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이전에 사용한 항목 (클릭하여 추가)
              </label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion.id || idx}
                    onClick={() => handleTagClick(suggestion.content)}
                    disabled={pendingItems.includes(suggestion.content)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      pendingItems.includes(suggestion.content)
                        ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                    }`}
                  >
                    {suggestion.content}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 직접 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 항목 직접 입력
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="항목 내용을 입력하고 Enter"
              />
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 추가된 항목들 */}
          {pendingItems.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                추가된 항목 ({pendingItems.length}개)
              </label>
              <div className="space-y-2">
                {pendingItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                      {index + 1}
                    </span>
                    {editingItemIndex === index ? (
                      <input
                        type="text"
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyPress={(e) => e.key === 'Enter' && handleFinishEdit()}
                        className="flex-1 px-3 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1">{item}</span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 작성 완료 버튼 */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsCreating(false);
                setTodoName('');
                setPendingItems([]);
              }}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleCreateTodo}
              disabled={!todoName.trim() || pendingItems.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              체크리스트 생성
            </button>
          </div>
        </div>
      )}

      {/* 태그 관리 모드 */}
      {isManagingTags && canManageTodo && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-orange-800">태그 관리 모드</h3>
            <button
              onClick={() => setIsManagingTags(false)}
              className="text-sm text-orange-600 hover:text-orange-800"
            >
              완료
            </button>
          </div>
          <p className="text-sm text-orange-700 mb-3">
            X 버튼을 눌러 불필요한 태그를 삭제할 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <div
                key={suggestion.id || idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-orange-200 rounded-full text-sm"
              >
                <span>{suggestion.content}</span>
                {suggestion.id && (
                  <button
                    onClick={() => handleDeleteTag(suggestion.id!)}
                    className="p-0.5 hover:bg-red-100 rounded-full"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                )}
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-orange-600">저장된 태그가 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* Daily Todos Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">오늘의 체크리스트</h2>
        </div>

        {dailyTodos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">오늘 등록된 체크리스트가 없습니다</p>
            {canManageTodo && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                체크리스트 작성하기
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
