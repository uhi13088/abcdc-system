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
  Filter,
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

// Team Checklist Types
interface TeamChecklistItem {
  id: string;
  item_name: string;
  item_type: string;
  is_required: boolean;
  display_order: number;
  min_value?: number;
  max_value?: number;
  unit?: string;
}

interface TeamChecklistRecordItem {
  item_id: string;
  is_checked: boolean;
  value_text?: string | null;
  value_number?: number | null;
}

interface TeamChecklist {
  id: string;
  checklist_name: string;
  checklist_category: string;
  description?: string;
  frequency: string;
  team_id: string;
  teams?: { id: string; name: string; team_type: string };
  items: TeamChecklistItem[];
  today_record?: { id: string; status: string };
  record_items: TeamChecklistRecordItem[];
  total_items: number;
  completed_items: number;
  progress: number;
}

interface UserTeam {
  id: string;
  name: string;
  team_type: string;
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

  // Team checklists state
  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [teamChecklists, setTeamChecklists] = useState<TeamChecklist[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [expandedTeamChecklists, setExpandedTeamChecklists] = useState<Set<string>>(new Set());

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

      // Fetch team checklists
      const teamChecklistsRes = await fetch('/api/haccp/team-checklists');
      if (teamChecklistsRes.ok) {
        const teamData = await teamChecklistsRes.json();
        setUserTeams(teamData.teams || []);
        setTeamChecklists(teamData.checklists || []);
        // Auto-expand in-progress checklists
        const inProgressIds = (teamData.checklists || [])
          .filter((c: TeamChecklist) => c.progress > 0 && c.progress < 100)
          .map((c: TeamChecklist) => c.id);
        setExpandedTeamChecklists(new Set(inProgressIds));
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

  // Team checklist handlers
  const toggleTeamChecklist = (checklistId: string) => {
    setExpandedTeamChecklists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checklistId)) {
        newSet.delete(checklistId);
      } else {
        newSet.add(checklistId);
      }
      return newSet;
    });
  };

  const handleTeamChecklistItemToggle = async (
    checklist: TeamChecklist,
    item: TeamChecklistItem,
    isChecked: boolean
  ) => {
    try {
      // Find current item status
      const currentItemRecord = checklist.record_items.find(ri => ri.item_id === item.id);

      const response = await fetch('/api/haccp/team-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: checklist.id,
          team_id: checklist.team_id,
          items: [{
            item_id: item.id,
            is_checked: isChecked,
            value_text: currentItemRecord?.value_text,
            value_number: currentItemRecord?.value_number,
          }],
        }),
      });

      if (response.ok) {
        // Optimistic update
        setTeamChecklists(prev => prev.map(c => {
          if (c.id !== checklist.id) return c;

          const newRecordItems = c.record_items.some(ri => ri.item_id === item.id)
            ? c.record_items.map(ri => ri.item_id === item.id ? { ...ri, is_checked: isChecked } : ri)
            : [...c.record_items, { item_id: item.id, is_checked: isChecked }];

          const completedItems = newRecordItems.filter(ri => ri.is_checked).length;

          return {
            ...c,
            record_items: newRecordItems,
            completed_items: completedItems,
            progress: c.total_items > 0 ? Math.round((completedItems / c.total_items) * 100) : 0,
          };
        }));

        if (isChecked) {
          toast.success('완료');
        }
      }
    } catch (error) {
      console.error('Failed to toggle team checklist item:', error);
      toast.error('저장 실패');
    }
  };

  // Filter team checklists by selected team
  const filteredTeamChecklists = selectedTeamFilter === 'all'
    ? teamChecklists
    : teamChecklists.filter(c => c.team_id === selectedTeamFilter);

  // Category labels
  const CATEGORY_LABELS: Record<string, string> = {
    hygiene: '위생점검',
    ccp: 'CCP 모니터링',
    equipment: '장비 온도',
    pest_control: '방충방서',
    storage: '보관창고',
    production: '생산관리',
    cleaning: '청소',
    opening: '오픈 체크',
    closing: '마감 체크',
    other: '기타',
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

      {/* Team Checklists */}
      {userTeams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">팀 체크리스트</h2>
            </div>
            {userTeams.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-lg bg-white"
                >
                  <option value="all">모든 팀</option>
                  {userTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filteredTeamChecklists.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">
                {selectedTeamFilter === 'all'
                  ? '할당된 팀 체크리스트가 없습니다'
                  : '선택한 팀에 할당된 체크리스트가 없습니다'}
              </p>
            </div>
          ) : (
            filteredTeamChecklists.map((checklist) => {
              const isExpanded = expandedTeamChecklists.has(checklist.id);

              return (
                <div key={checklist.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleTeamChecklist(checklist.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{checklist.checklist_name}</h3>
                            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                              {checklist.teams?.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {CATEGORY_LABELS[checklist.checklist_category] || checklist.checklist_category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            checklist.progress === 100 ? 'text-green-600' : 'text-emerald-600'
                          }`}>
                            {checklist.progress}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {checklist.completed_items}/{checklist.total_items}
                          </div>
                        </div>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${checklist.progress === 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                            style={{ width: `${checklist.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t divide-y">
                      {checklist.items.map((item) => {
                        const recordItem = checklist.record_items.find(ri => ri.item_id === item.id);
                        const isChecked = recordItem?.is_checked || false;

                        return (
                          <div
                            key={item.id}
                            className={`p-4 flex items-center gap-4 ${isChecked ? 'bg-green-50' : ''}`}
                          >
                            <button
                              onClick={() => handleTeamChecklistItemToggle(checklist, item, !isChecked)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isChecked
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-500'
                              }`}
                            >
                              {isChecked && <Check className="w-5 h-5" />}
                            </button>
                            <div className="flex-1">
                              <p className={isChecked ? 'line-through text-gray-400' : ''}>
                                {item.item_name}
                              </p>
                              {item.item_type !== 'checkbox' && (
                                <div className="flex items-center gap-2 mt-1">
                                  {item.item_type === 'temperature' && (
                                    <span className="text-xs text-gray-500">
                                      {item.min_value}°C ~ {item.max_value}°C
                                    </span>
                                  )}
                                  {item.item_type === 'number' && item.unit && (
                                    <span className="text-xs text-gray-500">
                                      단위: {item.unit}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {item.is_required && !isChecked && (
                              <span className="text-xs text-red-500">필수</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
