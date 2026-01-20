'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Bell, Pin, Eye, X, Edit, Trash2, Store, Building2 } from 'lucide-react';

interface Store {
  id: string;
  name: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'GENERAL' | 'URGENT' | 'EVENT' | 'UPDATE';
  is_pinned: boolean;
  view_count: number;
  store_id: string | null;
  store_name?: string;
  created_by: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
}

const categoryConfig = {
  GENERAL: { label: '일반', color: 'bg-gray-100 text-gray-800' },
  URGENT: { label: '긴급', color: 'bg-red-100 text-red-800' },
  EVENT: { label: '이벤트', color: 'bg-purple-100 text-purple-800' },
  UPDATE: { label: '업데이트', color: 'bg-blue-100 text-blue-800' },
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>(''); // '' = 전체, 'common' = 공통, store_id = 특정매장
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL' as Notice['category'],
    is_pinned: false,
    store_id: '' as string, // '' = 공통 공지
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
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (storeFilter === 'common') {
        params.set('store_id', 'null'); // 공통 공지만
      } else if (storeFilter) {
        params.set('store_id', storeFilter); // 특정 매장
      }
      const url = params.toString() ? `/api/notices?${params}` : '/api/notices';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setNotices(data);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [storeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        store_id: formData.store_id || null, // 공통은 null
      };
      const response = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        fetchNotices();
        setFormData({ title: '', content: '', category: 'GENERAL', is_pinned: false, store_id: '' });
      }
    } catch (error) {
      console.error('Failed to create notice:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchNotices();
      }
    } catch (error) {
      console.error('Failed to delete notice:', error);
    }
  };

  const sortedNotices = [...notices].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지사항</h1>
          <p className="mt-1 text-sm text-gray-500">직원들에게 공지사항을 전달합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">전체 공지</option>
            <option value="common">공통 공지만</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            공지 작성
          </button>
        </div>
      </div>

      {/* Notice List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {sortedNotices.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">등록된 공지사항이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${notice.is_pinned ? 'bg-yellow-50' : ''}`}
                  onClick={() => setSelectedNotice(notice)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {notice.is_pinned && (
                          <Pin className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryConfig[notice.category].color}`}>
                          {categoryConfig[notice.category].label}
                        </span>
                        {notice.store_id ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {notice.store_name || '매장'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            공통
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900">{notice.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notice.content}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500 ml-4">
                      <p>{format(new Date(notice.created_at), 'M/d', { locale: ko })}</p>
                      <p className="flex items-center gap-1 mt-1">
                        <Eye className="w-3 h-3" />
                        {notice.view_count}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">공지사항 작성</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="공지사항 제목을 입력하세요"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as Notice['category'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(categoryConfig).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대상 매장</label>
                <select
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">공통 (전체 매장)</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  공통 선택 시 모든 매장 직원에게 공지됩니다
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg h-48 resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_pinned" className="text-sm text-gray-700">상단 고정</label>
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
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {selectedNotice.is_pinned && <Pin className="w-4 h-4 text-yellow-600" />}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryConfig[selectedNotice.category].color}`}>
                    {categoryConfig[selectedNotice.category].label}
                  </span>
                </div>
                <h2 className="text-xl font-bold">{selectedNotice.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(selectedNotice.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                  {selectedNotice.author_name && ` · ${selectedNotice.author_name}`}
                </p>
              </div>
              <button onClick={() => setSelectedNotice(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{selectedNotice.content}</p>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => handleDelete(selectedNotice.id)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
